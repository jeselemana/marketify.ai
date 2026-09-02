import { randomUUID } from "node:crypto";

const COOKIE_NAME = "helmer_guest";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator === -1) return [part, ""];
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      }),
  );
}

function isValidGuestId(value) {
  return /^guest_[0-9a-f-]{36}$/i.test(value || "");
}

export function guestSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies[COOKIE_NAME];
  const ownerId = isValidGuestId(existing) ? existing : `guest_${randomUUID()}`;

  if (ownerId !== existing) {
    const forwardedProtocol = req.headers["x-forwarded-proto"];
    const secure = req.secure || forwardedProtocol === "https";
    res.append(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(ownerId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ONE_YEAR_SECONDS}${
        secure ? "; Secure" : ""
      }`,
    );
  }

  req.ownerId = ownerId;
  next();
}
