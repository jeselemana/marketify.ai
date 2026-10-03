import { parentPort, workerData } from 'node:worker_threads';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
async function extract() {
  const { extension, bytes } = workerData;
  const buffer = Buffer.from(bytes);
  const zip = await JSZip.loadAsync(buffer);
  const MAX_TOTAL_INFLATED = 10 * 1024 * 1024;
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  if (entries.length > 500) throw new Error("Office upload decompression limit exceeded");
  const contents = new Map();
  let inflatedBytes = 0;
  for (const entry of entries) {
    // Only decompress XML and relationship parts needed for validation and text extraction
    if (!/\.(?:xml|rels)$/i.test(entry.name)) continue;
    const chunks = [];
    await new Promise((resolve, reject) => {
      const stream = entry.nodeStream('nodebuffer');
      stream.on('data', chunk => {
        inflatedBytes += chunk.length;
        if (inflatedBytes > MAX_TOTAL_INFLATED) {
          stream.destroy(new Error('Office upload decompression limit exceeded'));
          return;
        }
        chunks.push(chunk);
      });
      stream.once('error', reject); stream.once('end', resolve);
    });
    const text = Buffer.concat(chunks).toString('utf8');
    if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw new Error("Unsafe Office upload");
    contents.set(entry.name, text);
  }
  let textContent = "";
  const append = value => {
    if (textContent.length + value.length > 200000) throw new Error('Office upload text limit exceeded');
    textContent += value;
  };
  if (extension === "docx") {
    const entry = zip.file("word/document.xml"); if (!entry) throw new Error("Invalid Word upload");
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(contents.get(entry.name));
    const read = value => {
      if (Array.isArray(value)) { value.forEach(read); return; }
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (key === "w:t") append(`${typeof child === "object" ? child["#text"] || "" : child} `);
        else read(child);
        if (key === "w:p" || key === "w:tr") append("\n");
      }
    };
    read(parsed);
  } else {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
    for (const sheet of workbook.worksheets) {
      append(`\nSheet: ${sheet.name}\n`);
      sheet.eachRow(row => { append(row.values.slice(1).map(value => value && typeof value === "object" ? value.formula ? `=${value.formula} (result: ${value.result ?? "unknown"})` : value.text || value.richText?.map(run => run.text).join("") || "" : value ?? "").join("\t") + "\n"); });
    }
  }
  if (textContent.length > 200000) throw new Error("Office upload text limit exceeded");

  return textContent;
}
extract().then(textContent => parentPort.postMessage({ textContent }), error => parentPort.postMessage({ error: error.message }));
