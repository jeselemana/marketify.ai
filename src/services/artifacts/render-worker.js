import { parentPort, workerData } from "node:worker_threads";
import { renderers, validateRenderedFile } from "./renderers.js";
try {
  const buffer = await renderers[workerData.kind](workerData.spec);
  await validateRenderedFile(buffer, workerData.kind);
  parentPort.postMessage({ buffer });
} catch (error) { parentPort.postMessage({ error: error.message }); }
