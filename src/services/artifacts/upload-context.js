import JSZip from "jszip";
import ExcelJS from "exceljs";
import { XMLParser, XMLValidator } from "fast-xml-parser";
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
  if (!["docx", "xlsx"].includes(extension) || file.textContent) return { ...file, data };
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  if (entries.length > 1500 || entries.reduce((sum, entry) => sum + (entry._data?.uncompressedSize || 0), 0) > 30 * 1024 * 1024) throw new Error("Office upload decompression limit exceeded");
  for (const entry of entries) if (/\.(?:xml|rels)$/.test(entry.name)) {
    const content = await entry.async("string");
    if (/<!DOCTYPE|<!ENTITY/i.test(content) || XMLValidator.validate(content) !== true) throw new Error("Unsafe Office upload");
  }
  let textContent = "";
  if (extension === "docx") {
    const entry = zip.file("word/document.xml"); if (!entry) throw new Error("Invalid Word upload");
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(await entry.async("string"));
    const read = value => {
      if (Array.isArray(value)) { value.forEach(read); return; }
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (key === "w:t") textContent += `${typeof child === "object" ? child["#text"] || "" : child} `;
        else read(child);
        if (key === "w:p" || key === "w:tr") textContent += "\n";
      }
    };
    read(parsed);
  } else {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
    for (const sheet of workbook.worksheets) {
      textContent += `\nSheet: ${sheet.name}\n`;
      sheet.eachRow(row => { textContent += row.values.slice(1).map(value => value && typeof value === "object" ? value.formula ? `=${value.formula} (result: ${value.result ?? "unknown"})` : value.text || value.richText?.map(run => run.text).join("") || "" : value ?? "").join("\t") + "\n"; });
    }
  }
  if (textContent.length > 200000) throw new Error("Office upload text limit exceeded");
  return { ...file, data, textContent };
}
