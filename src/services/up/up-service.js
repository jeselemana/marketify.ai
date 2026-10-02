import { randomUUID } from 'node:crypto';
import { UpAI, upLog } from './ai.js';
import { OnboardingSchema, PreferencesSchema, addEvent, calendar, completeChallenge, dashboard, duplicate, fail, maximumPoints, publicChallenge, scoreAnswer, selectChallenge, validateChallenge } from './domain.js';

const LEASE_MS = 125000;
export class UpService {
  constructor(repository, { ai = new UpAI(), now = () => Date.now(), telemetry = null } = {}) {
    this.repository = repository;
    this.ai = ai;
    this.now = now;
    this.telemetry = telemetry;
  }

  live(state) { if (state.deleted) fail('ACCOUNT_DELETED', 403); }
  ready(state) { this.live(state); if (!state.preferences) fail('ONBOARDING_REQUIRED', 409); }

  async home(ownerId) {
    const state = await this.repository.read(ownerId);
    this.live(state);
    return dashboard(state, this.now());
  }

  async opened(ownerId) {
    await this.repository.mutate(ownerId, state => {
      this.live(state);
      addEvent(state, 'opened', this.now());
    });
    await this.flush(ownerId);
    return this.home(ownerId);
  }

  async preferences(ownerId, value, onboarding = false) {
    const parsed = (onboarding ? OnboardingSchema : PreferencesSchema).parse(value);
    await this.repository.mutate(ownerId, state => {
      this.live(state);
      if (onboarding && state.preferences) fail('ONBOARDING_COMPLETE', 409);
      if (!onboarding) this.ready(state);
      const previous = state.preferences;
      state.preferences = {
        dailyGoal: parsed.dailyGoal,
        weeklyGoal: parsed.weeklyGoal,
        interests: parsed.interests,
        timezone: previous?.timezone || new Intl.DateTimeFormat('en', { timeZone: parsed.timezone }).resolvedOptions().timeZone,
        onboardedAt: previous?.onboardedAt || new Date(this.now()).toISOString(),
      };
      if (onboarding) addEvent(state, 'onboarding_completed', this.now());
      if (previous && previous.dailyGoal !== parsed.dailyGoal) addEvent(state, 'daily_goal_changed', this.now(), { goal: parsed.dailyGoal });
      if (previous && previous.weeklyGoal !== parsed.weeklyGoal) addEvent(state, 'weekly_goal_changed', this.now(), { goal: parsed.weeklyGoal });
    });
    await this.flush(ownerId);
    return this.home(ownerId);
  }

  async challenge(ownerId, id) {
    const state = await this.repository.read(ownerId);
    this.live(state);
    const challenge = state.challenges.find(c => c.id === id);
    if (!challenge) fail('NOT_FOUND', 404);
    return publicChallenge(challenge);
  }

  async start(ownerId, language) {
    const token = randomUUID();
    const reservation = await this.repository.mutate(ownerId, state => {
      this.ready(state);
      const active = state.challenges.find(c => c.status !== 'completed');
      if (active) return { existing: publicChallenge(active) };
      const now = this.now();
      if (state.generation?.until > now) fail('GENERATION_BUSY', 409);
      const day = calendar(now, state.preferences.timezone).day;
      const quota = state.quotas[day] ||= { generations: 0 };
      if (quota.generations >= 30) fail('DAILY_GENERATION_LIMIT', 429);
      quota.generations++;
      state.quotas = Object.fromEntries(Object.entries(state.quotas).filter(([date]) => date >= day.slice(0, 7)));
      state.generation = { token, until: now + LEASE_MS };
      const selection = selectChallenge(state);
      const history = state.challenges.slice(-25).map(c => ({
        title: c.title,
        topicKey: c.topicKey,
        category: c.category,
        scenario: (c.scenario || '').slice(0, 220),
        question: (c.question || '').slice(0, 120),
      }));
      return { selection, history, skills: state.skills, level: state.level };
    });

    if (reservation.existing) {
      upLog('challenge_reused');
      return reservation.existing;
    }

    try {
      let generated;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          generated = validateChallenge(await this.ai.generate({ language, ...reservation, attempt }), reservation.selection);
          const state = await this.repository.read(ownerId);
          if (duplicate(generated, state.challenges.slice(-50))) fail('DUPLICATE_GENERATION', 502);
          break;
        } catch (error) {
          if (attempt === 1 || !(error.name === 'ZodError' || ['INVALID_GENERATION', 'MODEL_OUTPUT_INVALID', 'DUPLICATE_GENERATION'].includes(error.code))) throw error;
          upLog('generation_retry', { code: error.code || 'SCHEMA_INVALID' });
        }
      }

      const challenge = await this.repository.mutate(ownerId, state => {
        this.ready(state);
        if (state.generation?.token !== token) fail('GENERATION_SUPERSEDED', 409);
        if (state.challenges.some(c => c.status !== 'completed')) fail('GENERATION_SUPERSEDED', 409);
        const maxFromOptions = Array.isArray(generated.options) && generated.options.length
          ? Math.max(...generated.options.map(o => o.score))
          : 0;
        const maxPts = Math.max(maxFromOptions, maximumPoints(generated.difficulty, generated.type));
        const item = {
          ...generated,
          id: randomUUID(),
          ownerId,
          maximumPoints: maxPts,
          status: 'ready',
          createdAt: new Date(this.now()).toISOString(),
          answer: null,
          result: null,
          attempts: 0,
        };
        state.challenges.push(item);
        state.generation = null;
        addEvent(state, 'challenge_started', this.now(), { challengeId: item.id, category: item.category, difficulty: item.difficulty });
        return publicChallenge(item);
      });

      await this.flush(ownerId);
      return challenge;
    } catch (error) {
      if (error.name === 'ZodError') { error.code = 'MODEL_OUTPUT_INVALID'; error.status = 502; }
      upLog('generation_failed', { code: error.code || error.name, status: error.status });
      await this.repository.mutate(ownerId, state => { if (state.generation?.token === token) state.generation = null; }).catch(() => {});
      throw error;
    }
  }

  async submit(ownerId, id, answer, language) {
    const token = randomUUID();
    const reserved = await this.repository.mutate(ownerId, state => {
      this.ready(state);
      const challenge = state.challenges.find(c => c.id === id);
      if (!challenge) fail('NOT_FOUND', 404);
      if (challenge.answer !== null && answer !== undefined && challenge.answer !== answer) fail('ANSWER_IMMUTABLE', 409);
      if (challenge.status === 'completed') return { completed: publicChallenge(challenge) };

      // Interactive Decision Test with options -> Instant evaluation without LLM latency
      if (Array.isArray(challenge.options) && challenge.options.length > 0) {
        if (!challenge.answer && answer === undefined) fail('ANSWER_REQUIRED');
        const candidate = String(answer || challenge.answer || '').trim();
        let selectedOption = challenge.options.find(o => o.id.toUpperCase() === candidate.toUpperCase())
          || challenge.options.find(o => o.text.trim() === candidate);
        if (!selectedOption) {
          fail('INVALID_OPTION', 400);
        }

        const optimalOption = challenge.options.find(o => o.is_optimal) || challenge.options.reduce((p, c) => c.score > p.score ? c : p);
        const scoredPoints = selectedOption.score;
        const isOptimal = Boolean(selectedOption.is_optimal);

        const scored = {
          points: scoredPoints,
          quality: scoredPoints / (challenge.maximumPoints || 40),
          selectedOptionId: selectedOption.id,
          selectedOptionText: selectedOption.text,
          isOptimal,
          tradeOff: selectedOption.trade_off,
          optimalOptionId: optimalOption.id,
          optimalOptionText: optimalOption.text,
          insiderInsight: challenge.insider_insight,
          breakdown: [
            { dimension: 'Strategic Thinking', score: isOptimal ? 4 : Math.max(1, Math.round(scoredPoints / (challenge.maximumPoints || 40) * 4)), points: scoredPoints, evidence: selectedOption.text }
          ],
        };

        challenge.answer = selectedOption.id;
        challenge.submittedAt = new Date(this.now()).toISOString();
        completeChallenge(state, challenge, scored, this.now());
        return { completed: publicChallenge(challenge) };
      }

      // Legacy fallback for rubric-based challenges
      if (challenge.leaseUntil > this.now()) fail('EVALUATION_BUSY', 409);
      if (!challenge.answer && answer === undefined) fail('ANSWER_REQUIRED');
      if (challenge.attempts >= 8) fail('EVALUATION_RETRY_LIMIT', 429);
      const day = calendar(this.now(), state.preferences.timezone).day;
      const quota = state.quotas[day] ||= { generations: 0 };
      if ((quota.evaluations || 0) >= 60) fail('DAILY_EVALUATION_LIMIT', 429);
      quota.evaluations = (quota.evaluations || 0) + 1;
      if (challenge.answer === null) {
        challenge.answer = answer;
        challenge.submittedAt = new Date(this.now()).toISOString();
        addEvent(state, 'challenge_submitted', this.now(), { challengeId: id });
      }
      challenge.attempts++;
      challenge.status = 'evaluating';
      challenge.leaseToken = token;
      challenge.leaseUntil = this.now() + LEASE_MS;
      return { challenge: structuredClone(challenge) };
    });

    if (reserved.completed) {
      upLog('duplicate_submission_prevented', { challengeId: id });
      await this.flush(ownerId);
      return reserved.completed;
    }

    try {
      let scored;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          scored = scoreAnswer(reserved.challenge, await this.ai.evaluate(reserved.challenge, language));
          break;
        } catch (error) {
          if (attempt === 1 || !(error.name === 'ZodError' || ['INVALID_EVALUATION', 'MODEL_OUTPUT_INVALID'].includes(error.code))) throw error;
          upLog('evaluation_retry', { challengeId: id });
        }
      }

      let result;
      try {
        result = await this.repository.mutate(ownerId, state => {
          this.ready(state);
          const challenge = state.challenges.find(c => c.id === id);
          if (!challenge) fail('NOT_FOUND', 404);
          if (challenge.status === 'completed') return publicChallenge(challenge);
          if (challenge.leaseToken !== token) fail('EVALUATION_SUPERSEDED', 409);
          completeChallenge(state, challenge, scored, this.now());
          return publicChallenge(challenge);
        });
      } catch (error) {
        upLog('points_transaction_failed', { challengeId: id, code: error.code || error.name });
        throw error;
      }
      await this.flush(ownerId);
      return result;
    } catch (error) {
      if (error.name === 'ZodError') { error.code = 'MODEL_OUTPUT_INVALID'; error.status = 502; }
      upLog('evaluation_failed', { challengeId: id, code: error.code || error.name, status: error.status });
      await this.repository.mutate(ownerId, state => {
        const challenge = state.challenges.find(c => c.id === id);
        if (challenge?.leaseToken === token && challenge.status !== 'completed') {
          challenge.status = 'evaluation_failed';
          challenge.leaseToken = null;
          challenge.leaseUntil = null;
          addEvent(state, 'evaluation_failed', this.now(), { challengeId: id, code: 'EVALUATION_FAILED' });
        }
      }).catch(() => {});
      await this.flush(ownerId);
      throw error;
    }
  }

  async flush(ownerId) {
    if (!this.telemetry?.trackUp) return;
    try {
      const events = (await this.repository.read(ownerId)).events;
      if (!events.length) return;
      for (const event of events) await this.telemetry.trackUp(ownerId, event);
      const ids = new Set(events.map(e => e.id));
      await this.repository.mutate(ownerId, state => { state.events = state.events.filter(e => !ids.has(e.id)); });
    } catch (error) {
      upLog('analytics_delivery_failed', { code: error.code || error.name });
    }
  }
}
