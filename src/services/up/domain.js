import { z } from 'zod';

export const CATEGORIES = ['Strategy', 'Marketing', 'Finance', 'Product', 'Operations', 'Leadership', 'AI'];
export const TYPES = ['scenario_analysis', 'decision', 'diagnosis', 'prioritization', 'strategy', 'numbers', 'ai'];
export const DIMENSIONS = ['Diagnosis', 'Prioritization', 'Reasoning', 'Trade-off Awareness', 'Financial Understanding', 'Strategic Thinking', 'Clarity', 'Risk Awareness', 'Decision'];

export const DIFFICULTY_MAP = {
  1: 'Starter',
  2: 'Operator',
  3: 'Strategist',
  4: 'Executive',
};

export const DIFFICULTY_TO_NUM = {
  Starter: 1,
  Operator: 2,
  Strategist: 3,
  Executive: 4,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
};

const text = (max) => z.string().trim().min(1).max(max);

export const PreferencesSchema = z.object({
  dailyGoal: z.number().int().min(10).max(1000),
  weeklyGoal: z.number().int().min(10).max(7000),
  interests: z.array(z.enum(CATEGORIES)).min(1).max(7).refine(v => new Set(v).size === v.length),
}).strict();

export const OnboardingSchema = PreferencesSchema.extend({
  timezone: text(80).refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } }, 'Invalid timezone'),
}).strict();

export const OptionSchema = z.object({
  id: z.enum(['A', 'B', 'C', 'D']),
  text: text(600),
  score: z.number().int().min(0).max(100),
  is_optimal: z.boolean(),
  trade_off: text(800),
}).strict();

export const GenerationSchema = z.object({
  category: z.enum(CATEGORIES),
  difficulty: z.union([z.number().int().min(1).max(4), z.enum(['Starter', 'Operator', 'Strategist', 'Executive'])]),
  title: text(160),
  scenario: text(2500),
  options: z.array(OptionSchema).min(4).max(4).optional(),
  insider_insight: text(1500).optional(),
  question: text(700).optional(),
  secondarySkills: z.array(z.enum(CATEGORIES)).max(3).optional().default([]),
  type: z.string().optional().default('decision'),
  topicKey: text(160).optional(),
  rubric: z.array(z.object({ dimension: z.enum(DIMENSIONS), criteria: text(600), weight: z.number().int().min(1).max(5) }).strict()).optional(),
}).strict();

export const EvaluationSchema = z.object({
  scores: z.array(z.object({ dimension: z.enum(DIMENSIONS), score: z.number().int().min(0).max(4), evidence: text(350) }).strict()).min(1).max(5),
  strength: text(500),
  missed: text(500),
  improvement: text(500),
}).strict();

export function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

export function emptyState(ownerId) {
  return {
    schemaVersion: 1,
    ownerId,
    revision: 0,
    preferences: null,
    totalPoints: 0,
    level: 1,
    streak: 0,
    lastActivityDay: null,
    skills: {},
    days: {},
    challenges: [],
    transactions: [],
    up_submissions: [],
    events: [],
    generation: null,
    quotas: {},
  };
}

// Calendar dates come from server timestamps in the practice timezone; weeks start Monday.
export function calendar(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const part = name => parts.find(p => p.type === name).value;
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  const date = new Date(`${day}T12:00:00Z`);
  const yesterday = new Date(date.getTime() - 86400000).toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return { day, yesterday, week: date.toISOString().slice(0, 10) };
}

export function levelFor(points) {
  let level = 1;
  while (points >= 100 * level * (level + 1)) level++;
  const floor = 100 * (level - 1) * level, next = 100 * level * (level + 1);
  return { level, floor, next };
}

export function maximumPoints(difficulty, type) {
  const d = typeof difficulty === 'number' ? difficulty : (DIFFICULTY_TO_NUM[difficulty] || 1);
  return [0, 40, 55, 75, 100][d] + (['numbers', 'strategy', 'ai'].includes(type) ? 5 : 0);
}

export function validateChallenge(value, selection) {
  const challenge = GenerationSchema.parse(value);
  const rawDifficulty = challenge.difficulty;
  if (typeof challenge.difficulty === 'string') {
    challenge.difficultyName = challenge.difficulty;
    challenge.difficulty = DIFFICULTY_TO_NUM[challenge.difficulty] || selection?.difficulty || 1;
  } else {
    challenge.difficultyName = DIFFICULTY_MAP[challenge.difficulty] || 'Starter';
  }
  if (selection) {
    if (selection.category && challenge.category !== selection.category) fail('INVALID_GENERATION', 502);
    if (selection.type && challenge.type !== selection.type) fail('INVALID_GENERATION', 502);
    const selDiffNum = typeof selection.difficulty === 'number' ? selection.difficulty : (DIFFICULTY_TO_NUM[selection.difficulty] || 1);
    if (challenge.difficulty !== selDiffNum && rawDifficulty !== selection.difficulty) fail('INVALID_GENERATION', 502);
  }
  if (challenge.secondarySkills) {
    if (new Set(challenge.secondarySkills).size !== challenge.secondarySkills.length || challenge.secondarySkills.includes(challenge.category)) fail('INVALID_GENERATION', 502);
  }
  if (!challenge.question) {
    challenge.question = 'Hansı strateji qərarı seçərdiniz?';
  }
  if (!challenge.topicKey) {
    challenge.topicKey = `${challenge.category.toLowerCase()}-${challenge.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
  }
  if (challenge.options) {
    const ids = challenge.options.map(o => o.id).sort().join('');
    if (ids !== 'ABCD') fail('INVALID_GENERATION', 502);
    if (!challenge.options.some(o => o.is_optimal)) {
      const maxScore = Math.max(...challenge.options.map(o => o.score));
      const best = challenge.options.find(o => o.score === maxScore) || challenge.options[0];
      best.is_optimal = true;
    }
  } else if (challenge.rubric) {
    if (new Set(challenge.rubric.map(r => r.dimension)).size !== challenge.rubric.length) fail('INVALID_GENERATION', 502);
  }
  return challenge;
}

export function scoreAnswer(challenge, value) {
  const evaluation = EvaluationSchema.parse(value);
  const dimensions = new Set((challenge.rubric || []).map(r => r.dimension));
  if (evaluation.scores.length !== dimensions.size || new Set(evaluation.scores.map(s => s.dimension)).size !== dimensions.size ||
      evaluation.scores.some(s => !dimensions.has(s.dimension))) fail('INVALID_EVALUATION', 502);
  const weight = challenge.rubric.reduce((sum, r) => sum + r.weight, 0);
  const breakdown = challenge.rubric.map(r => {
    const scored = evaluation.scores.find(s => s.dimension === r.dimension);
    const exact = challenge.maximumPoints * r.weight / weight * scored.score / 4;
    return { dimension: r.dimension, score: scored.score, evidence: scored.evidence, points: Math.floor(exact), fraction: exact % 1 };
  });
  const points = Math.round(breakdown.reduce((sum, row) => sum + row.points + row.fraction, 0));
  const remainder = points - breakdown.reduce((sum, row) => sum + row.points, 0);
  [...breakdown].sort((a, b) => b.fraction - a.fraction).slice(0, remainder).forEach(row => row.points++);
  return {
    evaluation,
    points,
    quality: evaluation.scores.reduce((sum, s) => sum + s.score * challenge.rubric.find(r => r.dimension === s.dimension).weight, 0) / (4 * weight),
    breakdown: breakdown.map(({ fraction, ...row }) => row),
  };
}

export function selectChallenge(state) {
  const interests = state.preferences.interests;
  const recent = state.challenges.filter(c => c.status === 'completed').slice(-8);
  const ranked = interests.map((category, index) => {
    const skill = state.skills[category];
    const repeats = recent.slice(-2).filter(c => c.category === category).length;
    return { category, priority: (skill?.score || 0) + repeats * 80 + (skill?.completed || 0) * 2 + index / 10 };
  }).sort((a, b) => a.priority - b.priority);
  const category = ranked[0].category, skill = state.skills[category];
  const samples = state.challenges.filter(c => c.status === 'completed' && c.category === category).slice(-5);
  const quality = samples.length ? samples.reduce((s, c) => s + (c.result?.quality ?? (c.result?.points ? c.result.points / (c.maximumPoints || 40) : 0)), 0) / samples.length : 0;
  let difficulty = skill?.difficulty || Math.min(2, 1 + Math.floor((state.level - 1) / 4));
  if (samples.length >= 2 && quality >= .75) difficulty = Math.min(4, difficulty + 1);
  if (samples.length >= 2 && quality < .35) difficulty = Math.max(1, difficulty - 1);
  const type = category === 'AI' ? 'ai' : TYPES.filter(t => t !== 'ai')[(state.challenges.length + interests.indexOf(category)) % 6];
  const difficultyName = DIFFICULTY_MAP[difficulty] || 'Starter';
  return {
    category,
    difficulty,
    difficultyName,
    type,
    reason: skill?.completed ? 'Practice selected interests with attention to recent performance.' : 'Explore one of your selected interests.',
  };
}

export function publicChallenge(c) {
  if (!c) return null;
  const isCompleted = c.status === 'completed';
  const difficultyName = c.difficultyName || (typeof c.difficulty === 'number' ? DIFFICULTY_MAP[c.difficulty] : c.difficulty) || 'Starter';
  return {
    id: c.id,
    title: c.title,
    scenario: c.scenario,
    question: c.question || 'Hansı strateji qərarı seçərdiniz?',
    category: c.category,
    secondarySkills: c.secondarySkills || [],
    type: c.type || 'decision',
    difficulty: typeof c.difficulty === 'number' ? c.difficulty : (DIFFICULTY_TO_NUM[c.difficulty] || 1),
    difficultyName,
    maximumPoints: c.maximumPoints,
    expectedDimensions: c.rubric ? c.rubric.map(r => r.dimension) : ['Strategic Thinking', 'Trade-off Awareness'],
    options: Array.isArray(c.options)
      ? c.options.map(o => isCompleted
          ? { id: o.id, text: o.text, score: o.score, is_optimal: Boolean(o.is_optimal), trade_off: o.trade_off }
          : { id: o.id, text: o.text })
      : null,
    insider_insight: isCompleted ? (c.insider_insight || c.result?.insiderInsight || null) : null,
    status: c.status,
    answer: c.answer || null,
    submittedAt: c.submittedAt || null,
    createdAt: c.createdAt,
    retryAt: c.leaseUntil || null,
    result: c.result || null,
  };
}

export function dashboard(state, now) {
  const preferences = state.preferences;
  if (!preferences) return { onboardingComplete: false, categories: CATEGORIES };
  const dates = calendar(now, preferences.timezone), level = levelFor(state.totalPoints);
  const daily = state.days[dates.day]?.points || 0;
  const weekly = Object.entries(state.days).filter(([day]) => day >= dates.week && day <= dates.day).reduce((sum, [, activity]) => sum + activity.points, 0);
  const streak = [dates.day, dates.yesterday].includes(state.lastActivityDay) ? state.streak : 0;
  return {
    onboardingComplete: true,
    preferences,
    categories: CATEGORIES,
    totalPoints: state.totalPoints,
    level,
    streak,
    daily: { points: daily, goal: preferences.dailyGoal, completed: daily >= preferences.dailyGoal },
    weekly: { points: weekly, goal: preferences.weeklyGoal, completed: weekly >= preferences.weeklyGoal },
    skills: CATEGORIES.map(category => ({ category, ...(state.skills[category] || { score: 0, completed: 0, difficulty: 1, activeDays: 0 }) })),
    activeChallenge: publicChallenge(state.challenges.find(c => c.status !== 'completed')),
    history: state.challenges.filter(c => c.status === 'completed').slice(-10).reverse().map(publicChallenge),
    recommendation: selectChallenge(state),
    generationRetryAt: state.generation?.until || null,
    serverTime: new Date(now).toISOString(),
  };
}

export function addEvent(state, type, now, metadata = {}) {
  state.events.push({ id: `up:${state.ownerId}:${state.revision}:${state.events.length}:${type}`, type, timestamp: new Date(now).toISOString(), metadata });
  state.events = state.events.slice(-200);
}

export function completeChallenge(state, challenge, scored, now) {
  if (state.transactions.some(t => t.challengeId === challenge.id)) return;
  const before = dashboard(state, now), dates = calendar(now, state.preferences.timezone);
  challenge.status = 'completed';
  challenge.completedAt = new Date(now).toISOString();
  challenge.leaseToken = null;
  challenge.leaseUntil = null;
  challenge.result = { ...scored, completedAt: challenge.completedAt };

  state.transactions.push({
    id: challenge.id,
    ownerId: state.ownerId,
    challengeId: challenge.id,
    points: scored.points,
    breakdown: scored.breakdown,
    timestamp: challenge.completedAt,
    day: dates.day,
    week: dates.week,
    scoringVersion: 2,
  });

  state.up_submissions ||= [];
  state.up_submissions.push({
    id: `sub_${challenge.id}`,
    challengeId: challenge.id,
    ownerId: state.ownerId,
    selectedOption: scored.selectedOptionId || challenge.answer,
    score: scored.points,
    isOptimal: Boolean(scored.isOptimal),
    tradeOff: scored.tradeOff || '',
    insiderInsight: scored.insiderInsight || challenge.insider_insight || '',
    timestamp: challenge.completedAt,
    day: dates.day,
  });

  state.totalPoints += scored.points;
  state.level = levelFor(state.totalPoints).level;
  const activity = state.days[dates.day] ||= { points: 0, completed: 0 };
  activity.points += scored.points;
  activity.completed++;
  if (state.lastActivityDay !== dates.day) {
    state.streak = state.lastActivityDay === dates.yesterday ? state.streak + 1 : 1;
    state.lastActivityDay = dates.day;
    addEvent(state, 'streak_increased', now, { streak: state.streak });
  }
  for (const category of [challenge.category, ...(challenge.secondarySkills || [])]) {
    const skill = state.skills[category] ||= { score: 0, completed: 0, difficulty: 1, activeDays: 0, lastDay: null };
    if (skill.lastDay !== dates.day) { skill.activeDays++; skill.lastDay = dates.day; }
    const quality = scored.quality ?? (scored.points / (challenge.maximumPoints || 40));
    const target = quality * (55 + (challenge.difficulty || 1) * 10) + Math.min(5, skill.activeDays);
    skill.score = Math.round(skill.completed ? skill.score * .7 + target * .3 : target);
    skill.completed++;
    skill.difficulty = challenge.difficulty || 1;
  }
  const after = dashboard(state, now);
  const milestones = [];
  if (!before.daily.completed && after.daily.completed) milestones.push('daily_goal_completed');
  if (!before.weekly.completed && after.weekly.completed) milestones.push('weekly_goal_completed');
  if (after.level.level > before.level.level) milestones.push('level_increased');
  challenge.result.milestones = milestones;
  for (const type of milestones) addEvent(state, type, now, { level: state.level });
  addEvent(state, 'challenge_completed', now, { challengeId: challenge.id, category: challenge.category, difficulty: challenge.difficulty });
  addEvent(state, 'points_earned', now, { challengeId: challenge.id, points: scored.points });
}

export function duplicate(candidate, history) {
  const words = value => (value || '').toLowerCase().replace(/\d+(?:[.,]\d+)?/g, '#').match(/[\p{L}#]+/gu) || [];
  const shingles = value => { const w = words(value); return new Set(w.slice(0, -2).map((_, i) => w.slice(i, i + 3).join(' '))); };
  const current = shingles((candidate.scenario || '') + ' ' + (candidate.title || candidate.question || ''));
  return history.some(old => {
    if (old.topicKey && candidate.topicKey && old.topicKey.toLowerCase() === candidate.topicKey.toLowerCase()) return true;
    const prior = shingles((old.scenario || '') + ' ' + (old.title || old.question || ''));
    const overlap = [...current].filter(word => prior.has(word)).length;
    return overlap / Math.max(1, Math.min(prior.size, current.size)) > .55;
  });
}
