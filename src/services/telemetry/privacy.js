import { createHash } from "node:crypto";
import { sanitizeTrainingText } from "../learning/sanitizer.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "passwd",
  "pwd",
  "parol",
  "email",
  "useremail",
  "phonenumber",
  "phone",
  "token",
  "bearertoken",
  "accesstoken",
  "refreshtoken",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "fullname",
  "firstname",
  "lastname",
  "username",
  "fin",
  "finkodu",
]);

/**
 * Creates a deterministic, privacy-preserving masked user/session identifier.
 * Example output: "usr_9a4f...3b"
 */
export function maskIdentifier(id) {
  if (!id || typeof id !== "string") {
    return "usr_anon...00";
  }
  const clean = id.trim();
  if (!clean) return "usr_anon...00";

  const hash = createHash("sha256").update(`helmer_usr_${clean}`).digest("hex");
  return `usr_${hash.slice(0, 4)}...${hash.slice(-2)}`;
}

/**
 * Anonymizes an IP address to preserve privacy while retaining subnet/region context.
 * IPv4: 192.168.1.42 -> 192.168.***.***
 * IPv6: 2001:db8:85a3::8a2e:370:7334 -> 2001:db8:****:****
 */
export function anonymizeIp(ip) {
  if (!ip || typeof ip !== "string") return "unknown";
  const clean = ip.replace(/^::ffff:/, "").trim();

  // IPv4
  if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
  }

  // IPv6
  if (clean.includes(":")) {
    const parts = clean.split(":");
    return `${parts.slice(0, 2).join(":")}:****:****`;
  }

  return "***.***.***.***";
}

/**
 * Infers a generalized business/market category from a brief or strategy context.
 */
export function categorizeBrief(text = "") {
  const content = String(text || "").toLowerCase();

  if (/(?:saas|ai|software|tətbiq|platforma|proqram|startup|tech|bulud|cloud|fintech)/i.test(content)) {
    return "SaaS & Texnologiya";
  }
  if (/(?:b2b|logistika|istehsal|tikinti|zavod|distribusiya|topdan|təchizat)/i.test(content)) {
    return "B2B & İstehsalat";
  }
  if (/(?:restoran|kafe|otel|turizm|klinika|tibbi|təhsil|kurs|mətbəx|servis|xidmət|service)/i.test(content)) {
    return "Lokal Xidmət & Qonaqpərvərlik";
  }
  if (/(?:agentlik|marketinq|reklam|media|kreativ|dizayn|smm|kontent)/i.test(content)) {
    return "Marketinq & Kreativ";
  }
  if (/(?:mağaza|store|e-commerce|satış|məhsul|brend|retail|pərakəndə|geyim|moda|kosmetika|skincare)/i.test(content)) {
    return "E-ticarət & Pərakəndə";
  }
  return "Ümumi Biznes Strategiyası";
}

/**
 * Redacts sensitive credentials, emails, phones, and personal tokens from text,
 * then truncates to a safe length for audit preview.
 */
export function redactSensitiveText(value, maxChars = 80) {
  if (!value) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value);
  const sanitized = sanitizeTrainingText(str).text;
  const singleLine = sanitized.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxChars) return singleLine;
  return `${singleLine.slice(0, maxChars)}...`;
}

/**
 * Recursively redacts an arbitrary payload object/array so no PII or raw secrets can leak.
 */
export function redactPayload(data, depth = 0) {
  if (depth > 6) return "[MAX_DEPTH]";
  if (data === null || data === undefined) return null;

  if (typeof data === "string") {
    return redactSensitiveText(data, 200);
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.slice(0, 20).map((item) => redactPayload(item, depth + 1));
  }

  const result = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z]/g, "");
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = "[REDACTED_PII]";
      continue;
    }
    if (key === "ip") {
      result[key] = anonymizeIp(value);
      continue;
    }
    if (key === "userId" || key === "ownerId" || key === "sessionId") {
      result[key] = maskIdentifier(value);
      continue;
    }
    result[key] = redactPayload(value, depth + 1);
  }
  return result;
}
