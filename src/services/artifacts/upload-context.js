import { Worker } from 'node:worker_threads';
import { executionContext } from '../security/privacy-policy.js';
import { MIME_TYPE_MAP, TEXT_LIKE_EXTENSIONS } from "../../../public/file-utils.js";

export function validUploadMetadata(file) {
  const extension = file.name.split(".").at(-1).toLowerCase();
  const expected = MIME_TYPE_MAP[extension];
  const mime = file.mimeType || file.type;
  return Boolean(expected && (mime === expected || (TEXT_LIKE_EXTENSIONS.has(extension) && /^(?:text\/|application\/(?:json|xml|x-yaml))/.test(mime))));
}

export async function prepareUploadedContext(file) {
  if (!validUploadMetadata(file)) throw new Error("Unsupported upload type");
  if (!file.data) return file;
  const data = file.data.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) throw new Error("Invalid file encoding");
  const buffer = Buffer.from(data, "base64");
  if (buffer.length > 20 * 1024 * 1024) throw new Error("Upload size limit exceeded");
  const extension = file.name.split(".").at(-1).toLowerCase();
  if (extension === "pdf" && buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF upload");
  if (!["docx", "xlsx"].includes(extension)) return { ...file, data };
  const textContent = await extractOffice(buffer, extension, executionContext.getStore()?.signal);
  return { ...file, data, textContent };
}

let waiting = 0, queue = Promise.resolve();
function extractOffice(buffer, extension, signal) {
  if (waiting >= 4) return Promise.reject(Object.assign(new Error('Upload queue full'), { status: 429, code: 'EXECUTION_BUSY' }));
  waiting++;
  const deadline = Date.now() + 30000;
  const operation = queue.then(() => new Promise((resolve, reject) => {
    if (signal?.aborted || Date.now() >= deadline) return reject(new Error('Upload cancelled or timed out'));
    const worker = new Worker(new URL('./upload-worker.js', import.meta.url), {
      workerData: { extension, bytes: buffer }, resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return; settled = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      void worker.terminate();
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(new Error('Upload cancelled'));
    const timer = setTimeout(() => finish(new Error('Upload processing timed out')), deadline - Date.now());
    signal?.addEventListener('abort', abort, { once: true });
    worker.once('message', result => finish(result.error ? new Error(result.error) : null, result.textContent));
    worker.once('error', error => finish(error));
    worker.once('exit', () => finish(new Error('Upload worker stopped')));
  }));
  queue = operation.catch(() => {});
  return operation.finally(() => { waiting--; });
}
