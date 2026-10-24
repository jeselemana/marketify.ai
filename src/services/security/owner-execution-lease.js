import { randomUUID } from 'node:crypto';

// Uses the same tenant key as HTTP admission; recovery cannot bypass active requests.
export async function acquireOwnerExecutionLease(redis, ownerId, controller) {
  if (!redis?.isReady) {
    if (process.env.NODE_ENV === 'production' || redis) throw Object.assign(new Error('Execution unavailable'), { code: 'EXECUTION_UNAVAILABLE', status: 503 });
    let released = false;
    return { assertOwned: async () => { if (released) throw Object.assign(new Error('Execution lease lost'), { code: 'EXECUTION_LOCK_LOST' }); }, release: async () => { released = true; } };
  }
  const key = `security:owner-execution:${ownerId}`, token = randomUUID();
  if (!await redis.set(key, token, { NX: true, PX: 180000 })) throw Object.assign(new Error('Execution busy'), { code: 'EXECUTION_BUSY', status: 429 });
  let released = false, renewing = false;
  const heartbeat = setInterval(async () => {
    if (renewing || released) return;
    renewing = true;
    try {
      if (!await redis.eval("if redis.call('get',KEYS[1]) ~= ARGV[1] then return 0 end; return redis.call('pexpire',KEYS[1],180000)", { keys: [key], arguments: [token] })) throw new Error('Lease lost');
    } catch { controller.abort(Object.assign(new Error('Execution lease lost'), { code: 'EXECUTION_LOCK_LOST' })); }
    finally { renewing = false; }
  }, 30000);
  heartbeat.unref();
  return { assertOwned: async () => {
    if (released || !redis.isReady || await redis.get(key) !== token) throw Object.assign(new Error('Execution lease lost'), { code: 'EXECUTION_LOCK_LOST' });
  }, release: async () => {
    if (released) return;
    released = true; clearInterval(heartbeat);
    await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) end; return 0", { keys: [key], arguments: [token] }).catch(() => {});
  } };
}
