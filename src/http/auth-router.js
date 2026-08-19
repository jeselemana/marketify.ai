import { OAuth2Client } from "google-auth-library";
import express from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  AccountUpdateSchema,
  AddMemoryItemSchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  OnboardingSchema,
  ResetPasswordSchema,
  SignupSchema,
  UserSettingsSchema,
  UsernameSchema,
  normalizeEmail,
  parseBody,
} from "../auth/validation.js";
import { hashOpaqueToken, hashPassword, verifyPassword } from "../auth/password.js";
import {
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from "./auth-middleware.js";

const RESET_TTL_SECONDS = 20 * 60;
const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=19456,p=1,t=2$vcP17Lqj+FV8BaSbIBHvAg$SvwldQJW4f14U7Cv2tgeeuVIFT0LfFBIUNxAGWfNPLU";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function publicUser(user) {
  const settings = user?.settings && typeof user.settings === "object" ? user.settings : {};
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    onboardingFocus: user.onboardingFocus,
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    settings: {
      personalIntelligence: settings.personalIntelligence === true,
      brandName: typeof settings.brandName === "string" ? settings.brandName : "",
      industry: typeof settings.industry === "string" ? settings.industry : "",
      targetAudience: typeof settings.targetAudience === "string" ? settings.targetAudience : "",
      primaryMarket: typeof settings.primaryMarket === "string" ? settings.primaryMarket : "",
      tone: typeof settings.tone === "string" ? settings.tone : "professional",
      customInstructions: typeof settings.customInstructions === "string" ? settings.customInstructions : "",
      memories: Array.isArray(settings.memories) ? settings.memories : [],
      autoContext: settings.autoContext !== false,
      strategyPersonalization: settings.strategyPersonalization !== false,
    },
    createdAt: user.createdAt,
  };
}

function rateKey(req, scope, identity = "") {
  const source = `${scope}:${req.ip || req.socket.remoteAddress || "unknown"}:${identity}`;
  return createHash("sha256").update(source).digest("hex");
}

function limit(authStore, scope, count, seconds, identity) {
  return asyncRoute(async (req, res, next) => {
    const result = await authStore.hitRateLimit(rateKey(req, scope, identity?.(req)), count, seconds);
    res.set("X-RateLimit-Remaining", String(result.remaining));
    if (!result.allowed) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))));
      return res.status(429).json({
        error: "Çox sayda cəhd edildi. Bir qədər sonra yenidən yoxla.",
        code: "RATE_LIMITED",
      });
    }
    return next();
  });
}

async function startSession(req, res, authStore, userId) {
  const rawToken = createSessionToken();
  const sessionId = hashOpaqueToken(rawToken);
  await authStore.createSession(sessionId, userId, SESSION_TTL_SECONDS);
  setSessionCookie(req, res, rawToken);
  return sessionId;
}

export function createAuthRouter({ userRepository, authStore, emailService, strategyRepository, chatRepository, plannerRepository, appUrl }) {
  const router = express.Router();

  router.get("/username-availability", limit(authStore, "username", 120, 60), asyncRoute(async (req, res) => {
    const raw = String(req.query.username || "").trim().replace(/^@+/, "");
    const parsed = UsernameSchema.safeParse(raw);
    if (!parsed.success) return res.json({ available: false, valid: false, error: parsed.error.issues[0]?.message });
    const existing = await userRepository.findByUsername(parsed.data);
    return res.json({ available: !existing, valid: true });
  }));

  router.post(
  "/google",
  limit(authStore, "google-login", 20, 15 * 60),
  asyncRoute(async (req, res) => {
    const credential = String(req.body?.credential || "");

    if (!credential) {
      return res.status(400).json({
        error: "Google giriş məlumatı göndərilməyib.",
        code: "GOOGLE_CREDENTIAL_REQUIRED",
      });
    }

    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        error: "Google girişi serverdə konfiqurasiya edilməyib.",
        code: "GOOGLE_AUTH_NOT_CONFIGURED",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const profile = ticket.getPayload();

    if (!profile?.sub || !profile?.email || !profile.email_verified) {
      return res.status(401).json({
        error: "Google hesabı təsdiqlənmədi.",
        code: "INVALID_GOOGLE_ACCOUNT",
      });
    }

    const email = normalizeEmail(profile.email);
    let user = await userRepository.findByEmail(email);

    if (!user) {
      const baseRaw = email.split("@")[0] || profile.name || "user";
      const username = await userRepository.findUniqueUsername(baseRaw);
      const randomPassword = randomBytes(48).toString("base64url");
      const passwordHash = await hashPassword(randomPassword);

      user = await userRepository.create({
        fullName: String(profile.name || email.split("@")[0]).trim(),
        username,
        email,
        passwordHash,
        emailVerifiedAt: new Date().toISOString(),
        avatarUrl: profile.picture || null,
        googleSub: profile.sub,
      });
    } else {
      user = await userRepository.update(user.id, {
        emailVerifiedAt:
          user.emailVerifiedAt || new Date().toISOString(),
        avatarUrl:
          user.avatarUrl || profile.picture || null,
        googleSub: profile.sub,
        lastLoginAt: new Date().toISOString(),
      });
    }

    await startSession(req, res, authStore, user.id);

    if (req.guestOwnerId && strategyRepository?.claimOwner) {
      await strategyRepository.claimOwner(req.guestOwnerId, user.id);
    }
    if (req.guestOwnerId && chatRepository?.claimOwner) {
      await chatRepository.claimOwner(req.guestOwnerId, user.id);
    }
    if (req.guestOwnerId && plannerRepository?.claimOwner) {
      await plannerRepository.claimOwner(req.guestOwnerId, user.id);
    }

    return res.json({
      user: publicUser(user),
    });
  }),
);

  router.post("/signup", limit(authStore, "signup", 8, 15 * 60), asyncRoute(async (req, res) => {
    const payload = parseBody(SignupSchema, req.body);
    const passwordHash = await hashPassword(payload.password);
    const user = await userRepository.create({ ...payload, passwordHash });
    await startSession(req, res, authStore, user.id);
    if (req.guestOwnerId && strategyRepository?.claimOwner) {
      await strategyRepository.claimOwner(req.guestOwnerId, user.id);
    }
    if (req.guestOwnerId && chatRepository?.claimOwner) {
      await chatRepository.claimOwner(req.guestOwnerId, user.id);
    }
    if (req.guestOwnerId && plannerRepository?.claimOwner) {
      await plannerRepository.claimOwner(req.guestOwnerId, user.id);
    }
    return res.status(201).json({ user: publicUser(user) });
  }));

  router.post("/login", limit(authStore, "login", 12, 15 * 60, (req) => String(req.body?.identifier || "").toLowerCase()), asyncRoute(async (req, res) => {
    const payload = parseBody(LoginSchema, req.body);
    const user = await userRepository.findByIdentifier(payload.identifier);
    const valid = await verifyPassword(user?.passwordHash || DUMMY_PASSWORD_HASH, payload.password);
    if (!user || !valid) {
      return res.status(401).json({
        error: "E-poçt/istifadəçi adı və ya şifrə yanlışdır.",
        code: "INVALID_CREDENTIALS",
      });
    }
    await startSession(req, res, authStore, user.id);
    const updated = await userRepository.markLogin(user.id);
    if (req.guestOwnerId && strategyRepository?.claimOwner) {
      await strategyRepository.claimOwner(req.guestOwnerId, user.id);
    }
    if (req.guestOwnerId && chatRepository?.claimOwner) {
      await chatRepository.claimOwner(req.guestOwnerId, user.id);
    }
    if (req.guestOwnerId && plannerRepository?.claimOwner) {
      await plannerRepository.claimOwner(req.guestOwnerId, user.id);
    }
    return res.json({ user: publicUser(updated || user) });
  }));

  router.get("/me", (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    return res.json({ user: publicUser(req.user) });
  });

  router.post("/logout", asyncRoute(async (req, res) => {
    if (req.auth?.sessionId) await authStore.deleteSession(req.auth.sessionId);
    clearSessionCookie(req, res);
    return res.status(204).end();
  }));

  router.patch("/account", asyncRoute(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    const payload = parseBody(AccountUpdateSchema, req.body);
    const updated = await userRepository.update(req.user.id, payload);
    return res.json({ user: publicUser(updated) });
  }));

  router.patch("/settings", asyncRoute(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    const payload = parseBody(UserSettingsSchema, req.body);
    const updated = await userRepository.update(req.user.id, {
      settings: {
        ...(req.user.settings && typeof req.user.settings === "object" ? req.user.settings : {}),
        ...payload,
      },
    });
    return res.json({ user: publicUser(updated) });
  }));

  router.post("/settings/memory", asyncRoute(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    const payload = parseBody(AddMemoryItemSchema, req.body);
    const currentMemories = Array.isArray(req.user.settings?.memories) ? req.user.settings.memories : [];
    if (currentMemories.length >= 50) {
      return res.status(400).json({ error: "Maksimum 50 yaddaş qeydi saxlanıla bilər.", code: "LIMIT_REACHED" });
    }
    const newMemory = {
      id: `mem_${randomUUID().slice(0, 8)}`,
      text: payload.text,
      category: payload.category || "general",
      createdAt: new Date().toISOString(),
    };
    const updatedMemories = [newMemory, ...currentMemories];
    const updated = await userRepository.update(req.user.id, {
      settings: {
        ...(req.user.settings && typeof req.user.settings === "object" ? req.user.settings : {}),
        memories: updatedMemories,
      },
    });
    return res.status(201).json({ memory: newMemory, user: publicUser(updated) });
  }));

  router.delete("/settings/memory/:id", asyncRoute(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    const memoryId = String(req.params.id || "").trim();
    const currentMemories = Array.isArray(req.user.settings?.memories) ? req.user.settings.memories : [];
    const filtered = currentMemories.filter((m) => m.id !== memoryId);
    const updated = await userRepository.update(req.user.id, {
      settings: {
        ...(req.user.settings && typeof req.user.settings === "object" ? req.user.settings : {}),
        memories: filtered,
      },
    });
    return res.json({ ok: true, user: publicUser(updated) });
  }));

  router.delete("/settings/memory", asyncRoute(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    const updated = await userRepository.update(req.user.id, {
      settings: {
        ...(req.user.settings && typeof req.user.settings === "object" ? req.user.settings : {}),
        memories: [],
      },
    });
    return res.json({ ok: true, user: publicUser(updated) });
  }));

  router.post("/onboarding", asyncRoute(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    const payload = parseBody(OnboardingSchema, req.body);
    const updated = await userRepository.update(req.user.id, {
      onboardingFocus: payload.focus,
      onboardingCompletedAt: new Date().toISOString(),
    });
    return res.json({ user: publicUser(updated) });
  }));

  router.post("/change-password", limit(authStore, "change-password", 8, 15 * 60, (req) => req.user?.id), asyncRoute(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    const payload = parseBody(ChangePasswordSchema, req.body);
    if (!(await verifyPassword(req.user.passwordHash, payload.currentPassword))) {
      return res.status(400).json({ error: "Cari şifrə yanlışdır.", code: "INVALID_CURRENT_PASSWORD" });
    }
    if (await verifyPassword(req.user.passwordHash, payload.newPassword)) {
      return res.status(400).json({ error: "Yeni şifrə cari şifrədən fərqli olmalıdır.", code: "PASSWORD_REUSED" });
    }
    await userRepository.updatePassword(req.user.id, await hashPassword(payload.newPassword));
    await authStore.invalidateUserSessions(req.user.id, req.auth.sessionId);
    return res.json({ ok: true });
  }));

  router.post("/forgot-password", limit(authStore, "forgot-password", 6, 30 * 60, (req) => normalizeEmail(req.body?.email)), asyncRoute(async (req, res) => {
    const generic = { message: "Bu e-poçt sistemdə varsa, şifrə yeniləmə keçidi göndərildi." };
    const parsed = ForgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.json(generic);
    const user = await userRepository.findByEmail(parsed.data.email);
    if (!user) return res.json(generic);
    const rawToken = randomBytes(32).toString("base64url");
    await authStore.createResetToken(hashOpaqueToken(rawToken), user.id, RESET_TTL_SECONDS);
    const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await emailService.sendPasswordResetEmail({ email: user.email, fullName: user.fullName, resetUrl });
    } catch (error) {
      console.error("Password reset email delivery failed", { name: error.name, message: error.message });
    }
    return res.json(generic);
  }));

  router.post("/reset-password", limit(authStore, "reset-password", 10, 30 * 60), asyncRoute(async (req, res) => {
    const payload = parseBody(ResetPasswordSchema, req.body);
    const reset = await authStore.consumeResetToken(hashOpaqueToken(payload.token));
    if (!reset) {
      return res.status(400).json({ error: "Keçid etibarsızdır və ya vaxtı bitib.", code: "INVALID_RESET_TOKEN" });
    }
    const user = await userRepository.findById(reset.userId);
    if (!user) return res.status(400).json({ error: "Keçid etibarsızdır və ya vaxtı bitib.", code: "INVALID_RESET_TOKEN" });
    await userRepository.updatePassword(user.id, await hashPassword(payload.password));
    await authStore.invalidateUserSessions(user.id);
    clearSessionCookie(req, res);
    return res.json({ ok: true });
  }));

  return router;
}

export function authErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.code === "VALIDATION_ERROR") {
    return res.status(400).json({ error: error.message, code: error.code, details: error.details });
  }
  if (error.code === "USER_CONFLICT") {
    return res.status(409).json({ error: error.message, code: error.code, field: error.field });
  }
  if (error.code === "ORIGIN_NOT_ALLOWED") {
    return res.status(403).json({ error: "Bu mənbədən girişə icazə verilmir.", code: error.code });
  }
  console.error("Authentication request failed", { path: req.path, name: error.name, code: error.code });
  return res.status(500).json({ error: "Sorğunu tamamlamaq mümkün olmadı.", code: "AUTH_ERROR" });
}
