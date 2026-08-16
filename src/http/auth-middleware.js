import { randomBytes } from "node:crypto";
import { hashOpaqueToken } from "../auth/password.js";

export const SESSION_COOKIE = "marketify_session";
export const GUEST_COOKIE = "marketify_guest";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    if (separator === -1) return [part, ""];
    try { return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))]; }
    catch { return [part.slice(0, separator), ""]; }
  }));
}

function secureRequest(req) {
  const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return req.secure || forwarded === "https";
}

export function setSessionCookie(req, res, token) {
  res.append("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureRequest(req) ? "; Secure" : ""}`);
}

export function clearSessionCookie(req, res) {
  res.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureRequest(req) ? "; Secure" : ""}`);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function createIdentityMiddleware({ authStore, userRepository }) {
  return async function identity(req, res, next) {
    try {
      const cookies = parseCookies(req.headers.cookie);
      req.guestOwnerId = /^guest_[0-9a-f-]{36}$/i.test(cookies[GUEST_COOKIE] || "")
        ? cookies[GUEST_COOKIE]
        : null;
      const rawToken = cookies[SESSION_COOKIE];
      if (!rawToken || rawToken.length > 200) return next();
      const sessionId = hashOpaqueToken(rawToken);
      const session = await authStore.getSession(sessionId);
      if (!session) {
        clearSessionCookie(req, res);
        return next();
      }
      const user = await userRepository.findById(session.userId);
      if (!user) {
        await authStore.deleteSession(sessionId);
        clearSessionCookie(req, res);
        return next();
      }
      req.auth = { user, sessionId };
      req.user = user;
      req.ownerId = user.id;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireAuth(req, res, next) {
  if (req.auth?.user) return next();
  return res.status(401).json({ error: "Davam etmək üçün hesabına daxil ol.", code: "AUTH_REQUIRED" });
}
