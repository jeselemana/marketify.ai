import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const GUEST_COOKIE = "helmer_guest";
const COOKIE_NAME = GUEST_COOKIE;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const GUEST_SECRET = process.env.SESSION_SECRET || process.env.AUTH_SECRET || "helmer_guest_hmac_secret_fallback_key";

export function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator === -1) return [part, ""];
        try {
          return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
        } catch {
          return [part.slice(0, separator), ""];
        }
      }),
  );
}

export function isValidGuestId(value) {
  return /^guest_[0-9a-f-]{36}$/i.test(value || "");
}

export function signGuestId(guestId) {
  const signature = createHmac("sha256", GUEST_SECRET).update(guestId).digest("hex").slice(0, 32);
  return `${guestId}.${signature}`;
}

export function verifyGuestCookie(cookieValue) {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex === -1) return null;
  const guestId = cookieValue.slice(0, dotIndex);
  const signature = cookieValue.slice(dotIndex + 1);
  if (!isValidGuestId(guestId)) return null;
  const expected = createHmac("sha256", GUEST_SECRET).update(guestId).digest("hex").slice(0, 32);
  if (signature.length !== expected.length) return null;
  try {
    if (timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
      return guestId;
    }
  } catch {
    return null;
  }
  return null;
}

export function guestSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const rawCookie = cookies[COOKIE_NAME];
  const verifiedGuestId = verifyGuestCookie(rawCookie);
  const ownerId = verifiedGuestId || `guest_${randomUUID()}`;

  if (!verifiedGuestId) {
    const forwardedProtocol = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const secure = req.secure || forwardedProtocol === "https";
    const signedValue = signGuestId(ownerId);
    res.append(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(signedValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ONE_YEAR_SECONDS}${
        secure ? "; Secure" : ""
      }`,
    );
  }

  req.ownerId = ownerId;
  next();
}
