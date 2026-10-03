import { createHash, createHmac, randomUUID } from 'node:crypto';
import net from 'node:net';
import { executionContext } from './privacy-policy.js';

const fail = (code, status = 503) => Object.assign(new Error(code), { code, status });

export const DEFAULT_MODEL_PRICING = Object.freeze({
  'gemini-3.8-flash': { input: 0.75, output: 3.75, search: 0.035 },
  'gemini-3.8-flash-high': { input: 0.75, output: 3.75, search: 0.035 },
  'gpt-5.6-luna': { input: 0.25, output: 1.00, search: 0.030 },
  'gpt-6-luna': { input: 0.25, output: 1.00, search: 0.030 },
  'gpt-5.6-terra': { input: 1.25, output: 5.00, search: 0.035 },
  'gpt-6-sol': { input: 2.00, output: 10.00, search: 0.050 },
  'gpt-4o': { input: 2.50, output: 10.00, search: 0.035 },
  'default': { input: 2.50, output: 10.00, search: 0.035 },
});

export function isAiRequest(req) {
  return req.method === 'POST' && (
    /^\/api\/ask(?:\/research)?\/?$/i.test(req.path) ||
    /^\/api\/strategy\/(?:assess|generate|generate-stream|refine|summary|summarize|[^/]+\/refine)\/?$/i.test(req.path) ||
    /^\/api\/planner\/(?:summarize|prioritize)\/?$/i.test(req.path) ||
    /^\/api\/up\/challenges\/?$/i.test(req.path) ||
    /^\/api\/user\/ai-summary\/?$/i.test(req.path)
  );
}
export class AiPolicy {
  constructor({ redis, env = process.env, fetcher = fetch }) { this.redis = redis; this.env = env; this.fetcher = fetcher; }
  ready() {
    if (this.env.NODE_ENV === 'production' && !this.redis?.isReady) throw fail('EXECUTION_UNAVAILABLE');
    if (this.redis && !this.redis.isReady) throw fail('EXECUTION_UNAVAILABLE');
  }
  async turnstile(req) {
    if (!this.env.TURNSTILE_SECRET_KEY) return;
    const token = req.get('X-Helmer-Turnstile-Token');
    if (!token || token.length > 2048) throw fail('BOT_VERIFICATION_REQUIRED', 403);
    const response = await this.fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ secret: this.env.TURNSTILE_SECRET_KEY, response: token, remoteip: req.ip || req.socket?.remoteAddress }),
    });
    const result = await response.json();
    let appHost = 'helmeros.com';
    try {
      if (this.env.APP_URL) appHost = new URL(this.env.APP_URL).hostname;
    } catch {}
    const allowedHosts = new Set([appHost, 'helmeros.com', 'www.helmeros.com', 'localhost', '127.0.0.1']);
    if (!result.success || (result.action && result.action !== 'guest-ai') || (result.hostname && !allowedHosts.has(result.hostname))) throw fail('BOT_VERIFICATION_FAILED', 403);
  }
  ipKey(req) {
    let ip = String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
    if (net.isIP(ip) === 6) ip = ip.split(':').slice(0, 4).join(':');
    return createHmac('sha256', this.env.SESSION_SECRET || this.env.AUTH_SECRET || 'local-only').update(ip).digest('hex');
  }
  middleware() {
    return async (req, res, next) => {
      if (!/^\/api\/(?:ask|strategy|planner|up|user|artifacts)(?:\/|$)/i.test(req.path)) return next();
      if (req.user && !req.user.emailVerifiedAt) return res.status(403).json({ code: 'EMAIL_VERIFICATION_REQUIRED', error: 'E-poçtunu təsdiqlə.' });
      const guest = !req.user;
      if (guest && (/^\/api\/(?:up|user|artifacts)(?:\/|$)/i.test(req.path) || /^\/api\/ask\/research(?:\/|$)/i.test(req.path))) return res.status(401).json({ code: 'AUTH_REQUIRED' });
      if (!isAiRequest(req)) return next();
      let controller;
      if (!this.redis?.isReady) {
        if (this.env.NODE_ENV === 'production') {
          return res.status(503).json({ code: 'EXECUTION_UNAVAILABLE', error: 'Sorğu icra edilə bilmədi.' });
        }
        controller = new AbortController();
        req.securityContext.route = req.path;
        req.securityContext.controller = controller;
        req.securityContext.signal = controller.signal;
        return next();
      }
      let quotaKeys = [], requestKey, lock;
      const token = randomUUID();
      let finished = false;
      const finish = async () => {
        if (finished) return; finished = true;
        clearTimeout(timer);
        if (!req.securityContext?.isBackgroundJob) {
          controller?.abort();
        }
        if (lock) await this.redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end; return 0", { keys: [lock], arguments: [token] }).catch(() => {});
        if (!req.securityContext?.providerStarted && quotaKeys.length) await this.redis.eval("for _,k in ipairs(KEYS) do local n = tonumber(redis.call('get', k) or '0'); if n > 0 then redis.call('decr',k) end end; return 1", { keys: quotaKeys }).catch(() => {});
        if (requestKey) await this.redis.set(requestKey, JSON.stringify({ state: req.securityContext?.providerStarted ? 'started' : 'rejected' }), { EX: 900 }).catch(() => {});
      };
      let timer;
      try {
        if (guest) await this.turnstile(req);
        this.ready();
        const id = req.get('Idempotency-Key');
        if (!id || !/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw fail('IDEMPOTENCY_KEY_REQUIRED', 400);
        requestKey = `security:request:${createHash('sha256').update(`${req.ownerId}:${req.path}:${id}`).digest('hex')}`;
        if (!await this.redis.set(requestKey, JSON.stringify({ state: 'reserved' }), { NX: true, EX: 900 })) { requestKey = null; throw fail('REQUEST_ALREADY_SUBMITTED', 409); }
        const actor = req.ownerId, ip = this.ipKey(req), day = new Date().toISOString().slice(0, 10);
        const keys = [`security:rate:${actor}`, `security:rate-ip:${ip}`];
        const allowed = await this.redis.eval("for _,k in ipairs(KEYS) do if tonumber(redis.call('get',k) or '0') >= tonumber(ARGV[1]) then return 0 end end; for _,k in ipairs(KEYS) do local n = redis.call('incr',k); if n == 1 then redis.call('expire',k,600) end end; return 1", { keys, arguments: ['60'] });
        if (!allowed) throw fail('RATE_LIMITED', 429);
        if (guest) {
          quotaKeys = [`security:guest-day:${day}:${actor}`, `security:guest-ip-day:${day}:${ip}`];
          const admitted = await this.redis.eval("for _,k in ipairs(KEYS) do if tonumber(redis.call('get',k) or '0') >= 2 then return 0 end end; for _,k in ipairs(KEYS) do redis.call('incr',k); redis.call('expire',k,172800) end; return 1", { keys: quotaKeys });
          if (!admitted) { quotaKeys = []; throw fail('GUEST_DAILY_LIMIT', 429); }
        }
        lock = `security:owner-execution:${actor}`;
        if (!await this.redis.set(lock, token, { NX: true, PX: 180000 })) { lock = null; throw fail('EXECUTION_BUSY', 429); }
        controller = new AbortController();
        req.securityContext.route = req.path;
        req.securityContext.controller = controller; req.securityContext.signal = controller.signal;
        const renewal = setInterval(async () => {
          try {
            const ok = await this.redis.eval("if redis.call('get',KEYS[1]) ~= ARGV[1] then return 0 end; return redis.call('pexpire',KEYS[1],180000)", { keys: [lock], arguments: [token] });
            if (!ok) controller.abort(fail('EXECUTION_LOCK_LOST'));
          } catch { controller.abort(fail('EXECUTION_UNAVAILABLE')); }
        }, 30000); renewal.unref();
        timer = setTimeout(() => { clearInterval(renewal); controller.abort(fail('EXECUTION_TIMEOUT')); if (!res.headersSent) res.status(504).json({ code: 'EXECUTION_TIMEOUT' }); else res.end(); }, 180000);
        res.once('finish', () => { clearInterval(renewal); void finish(); });
        res.once('close', () => { clearInterval(renewal); void finish(); });
        next();
      } catch (error) {
        await finish();
        res.status(error.status || 503).json({ code: error.code || 'EXECUTION_UNAVAILABLE', error: 'Sorğu başlana bilmədi.' });
      }
    };
  }
  async reserveProvider(context, params) {
    if (!this.redis?.isReady) {
      if (this.env.NODE_ENV === 'production') throw fail('EXECUTION_UNAVAILABLE', 503);
      return async () => {};
    }
    this.ready();
    let prices = {};
    try {
      if (this.env.AI_MODEL_PRICING) {
        prices = JSON.parse(this.env.AI_MODEL_PRICING);
      }
    } catch {
      prices = {};
    }
    const modelKey = params?.model || 'default';
    const price = prices[modelKey] ||
                  prices[String(modelKey).toLowerCase()] ||
                  DEFAULT_MODEL_PRICING[modelKey] ||
                  DEFAULT_MODEL_PRICING[String(modelKey).toLowerCase()] ||
                  DEFAULT_MODEL_PRICING.default;
    if (!price || !Number.isFinite(price.input) || !Number.isFinite(price.output) || price.input < 0 || price.output <= 0) throw fail('MODEL_PRICING_UNAVAILABLE');
    const tools = params.tools || params.config?.tools || [];
    const searching = tools.some(tool => tool.googleSearch || /web_search/.test(tool.type || ''));
    const searchPrice = Number.isFinite(price.search) ? price.search : 0.035;
    if (searching && (!Number.isFinite(searchPrice) || searchPrice < 0)) throw fail('TOOL_PRICING_UNAVAILABLE');
    const input = Buffer.byteLength(JSON.stringify(params)), output = Math.min(params.max_output_tokens || params.max_completion_tokens || params.max_tokens || params.config?.maxOutputTokens || 16384, 16384);
    const micros = Math.ceil(input * price.input + output * price.output + (searching ? searchPrice * 1000000 : 0));
    const day = new Date().toISOString().slice(0, 10), keys = [`security:budget:${day}:${context.ownerId}`, `security:budget:${day}:global`];
    const userLimit = Number(this.env.AI_USER_DAILY_USD || 5), globalLimit = Number(this.env.AI_PLATFORM_DAILY_USD || 100);
    if (!(userLimit > 0 && globalLimit > 0)) throw fail('BUDGET_CONFIGURATION_INVALID');
    const token = randomUUID(), now = Date.now();
    const accepted = await this.redis.eval("redis.call('zremrangebyscore',KEYS[3],'-inf',ARGV[4]); if redis.call('zcard',KEYS[3]) >= 8 then return -1 end; if tonumber(redis.call('get',KEYS[1]) or '0') + tonumber(ARGV[1]) > tonumber(ARGV[2]) or tonumber(redis.call('get',KEYS[2]) or '0') + tonumber(ARGV[1]) > tonumber(ARGV[3]) then return 0 end; for i=1,2 do redis.call('incrby',KEYS[i],ARGV[1]); redis.call('expire',KEYS[i],172800) end; redis.call('zadd',KEYS[3],ARGV[5],ARGV[6]); return 1", { keys: [...keys, 'security:provider-slots'], arguments: [String(micros), String(Math.floor(userLimit * 1000000)), String(Math.floor(globalLimit * 1000000)), String(now), String(now + 180000), token] });
    if (accepted !== 1) throw fail(accepted === -1 ? 'EXECUTION_BUSY' : 'DAILY_BUDGET_EXCEEDED', 429);
    const heartbeat = setInterval(async () => {
      try { if (!this.redis.isReady || !await this.redis.zScore('security:provider-slots', token)) throw fail('EXECUTION_LOCK_LOST'); await this.redis.zAdd('security:provider-slots', { score: Date.now() + 180000, value: token }); }
      catch (error) { context.controller?.abort(error); }
    }, 30000); heartbeat.unref();
    return async () => { clearInterval(heartbeat); await this.redis.zRem('security:provider-slots', token).catch(() => {}); };
  }
}
