import { Worker } from "node:worker_threads";
function renderWorker(kind, spec, { signal, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Artifact execution canceled"));
    const worker = new Worker(new URL("./render-worker.js", import.meta.url), { workerData: { kind, spec }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    let settled = false;
    const finish = (error, buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.terminate();
      if (error) reject(error); else resolve(Buffer.from(buffer));
    };
    const abort = () => finish(new Error("Artifact execution canceled"));
    const timer = setTimeout(() => finish(new Error("Artifact renderer timed out")), timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    worker.once("message", message => finish(message.error ? new Error(message.error) : null, message.buffer));
    worker.once("error", error => finish(error));
    worker.once("exit", code => { if (code !== 0) finish(new Error("Artifact renderer stopped")); });
  });
}

let queue = Promise.resolve(), waiting = 0;
export function renderArtifact(kind, spec, { signal, timeoutMs = 30000 } = {}) {
  if (waiting >= 4) return Promise.reject(Object.assign(new Error('Artifact render queue full'), { status: 429, code: 'EXECUTION_BUSY' }));
  const started = Date.now(); waiting++;
  const operation = queue.then(() => {
    signal?.throwIfAborted();
    const remaining = timeoutMs - (Date.now() - started);
    if (remaining <= 0) throw new Error('Artifact renderer timed out');
    return renderWorker(kind, spec, { signal, timeoutMs: remaining });
  });
  queue = operation.catch(() => {});
  return operation.finally(() => { waiting--; });
}
