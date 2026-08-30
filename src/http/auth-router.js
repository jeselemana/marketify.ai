import { OAuth2Client } from "google-auth-library";
import express from "express";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  AccountUpdateSchema,
  AddMemoryItemSchema,
  ChangePasswordSchema,
  EmailVerificationConfirmSchema,
  EmailVerificationRequestSchema,
  ForgotPasswordSchema,
  ImportMemoryPayloadSchema,
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
const EMAIL_VERIFICATION_TTL_SECONDS = 10 * 60;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=19456,p=1,t=2$vcP17Lqj+FV8BaSbIBHvAg$SvwldQJW4f14U7Cv2tgeeuVIFT0LfFBIUNxAGWfNPLU";
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
    status: user.status === "pending_deletion" ? "pending_deletion" : "active",
    deletionRequestedAt: user.deletionRequestedAt || null,
    scheduledDeletionAt: user.scheduledDeletionAt || null,
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
      defaultMode: settings.defaultMode === "ask" ? "ask" : "build",
      language: settings.language === "en" ? "en" : "az",
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

export function createAuthRouter({ userRepository, authStore, emailService, strategyRepository, chatRepository, plannerRepository, aiLearningRepository, appUrl }) {
  // server.js loads dotenv after ESM imports have been evaluated. Resolve this
  // value when the router is created so the configured client ID is available.
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClient = new OAuth2Client(googleClientId);
  const router = express.Router();

  async function sendEmailVerificationCode(user) {
    const code = String(randomInt(100000, 1000000));
    const tokenId = hashOpaqueToken(`${user.id}:${code}`);
    await authStore.createEmailVerificationToken(tokenId, user.id, EMAIL_VERIFICATION_TTL_SECONDS);
    try {
      await emailService.sendEmailVerificationCode({ email: user.email, fullName: user.fullName, code });
    } catch (error) {
      // Do not leave a usable code behind if delivery fails.
      await authStore.consumeEmailVerificationToken(tokenId);
      console.error("Email verification delivery failed", {
        userId: user.id,
        emailDomain: user.email.split("@")[1] || "unknown",
        message: error.message,
      });
      throw error;
    }
  }

  async function claimGuestData(req, userId) {
    if (req.guestOwnerId && strategyRepository?.claimOwner) await strategyRepository.claimOwner(req.guestOwnerId, userId);
    if (req.guestOwnerId && chatRepository?.claimOwner) await chatRepository.claimOwner(req.guestOwnerId, userId);
    if (req.guestOwnerId && plannerRepository?.claimOwner) await plannerRepository.claimOwner(req.guestOwnerId, userId);
    if (req.guestOwnerId && aiLearningRepository?.claimOwner) await aiLearningRepository.claimOwner(req.guestOwnerId, userId);
  }

  async function startEmailVerificationCooldown(req, email) {
    return authStore.hitRateLimit(
      rateKey(req, "email-verification-resend-cooldown", email),
      1,
      EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
    );
  }

  router.get("/config", (req, res) => {
    return res.json({
      googleClientId: googleClientId || "",
    });
  });

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

    if (!googleClientId) {
      return res.status(503).json({
        error: "Google girişi serverdə konfiqurasiya edilməyib.",
        code: "GOOGLE_AUTH_NOT_CONFIGURED",
      });
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });
    } catch (verifyError) {
      console.warn("Google ID token verification failed:", verifyError?.message || verifyError);
      return res.status(401).json({
        error: "Google giriş məlumatı etibarsızdır və ya vaxtı bitib.",
        code: "INVALID_GOOGLE_TOKEN",
      });
    }

    const profile = ticket?.getPayload();

    if (!profile?.sub || !profile?.email || !profile.email_verified) {
      return res.status(401).json({
        error: "Google hesabı təsdiqlənmədi.",
        code: "INVALID_GOOGLE_ACCOUNT",
      });
    }

    const email = normalizeEmail(profile.email);
    let user = await userRepository.findByEmail(email);

    let restoredFromPendingDeletion = false;
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
      if (user.scheduledDeletionAt) {
        const scheduledTime = new Date(user.scheduledDeletionAt).getTime();
        if (!isNaN(scheduledTime) && scheduledTime <= Date.now()) {
          await userRepository.purgeExpiredAccounts({ strategyRepository, chatRepository, plannerRepository, aiLearningRepository, authStore }).catch(() => {});
          return res.status(401).json({
            error: "Hesabınız 14 günlük gözləmə müddəti bitdiyinə görə tamamilə silinib.",
            code: "ACCOUNT_EXPIRED_DELETED",
          });
        }
        await userRepository.cancelDeletion(user.id);
        restoredFromPendingDeletion = true;
      }
      user = await userRepository.update(user.id, {
        emailVerifiedAt:
          user.emailVerifiedAt || new Date().toISOString(),
        avatarUrl:
          user.avatarUrl || profile.picture || null,
        googleSub: profile.sub,
        lastLoginAt: new Date().toISOString(),
        status: "active",
        deletionRequestedAt: null,
        scheduledDeletionAt: null,
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
      restoredFromPendingDeletion,
    });
  }),
);

  router.post("/signup", limit(authStore, "signup", 8, 15 * 60), asyncRoute(async (req, res) => {
    const payload = parseBody(SignupSchema, req.body);
    const passwordHash = await hashPassword(payload.password);
    const user = await userRepository.create({ ...payload, passwordHash });
    try {
      await sendEmailVerificationCode(user);
      await startEmailVerificationCooldown(req, user.email);
    } catch {
      return res.status(202).json({
        verificationRequired: true,
        deliveryPending: true,
        email: user.email,
        message: "Hesab yaradıldı, lakin təsdiq kodu göndərilmədi. Kodu yenidən göndərmək üçün davam et.",
      });
    }
    return res.status(201).json({
      verificationRequired: true,
      email: user.email,
      resendAfterSeconds: EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
    });
  }));

  router.post("/email-verification/resend", limit(authStore, "email-verification-resend", 3, 15 * 60, (req) => normalizeEmail(req.body?.email)), asyncRoute(async (req, res) => {
    const payload = parseBody(EmailVerificationRequestSchema, req.body);
    const user = await userRepository.findByEmail(payload.email);
    if (user && !user.emailVerifiedAt) {
      const cooldown = await startEmailVerificationCooldown(req, user.email);
      if (!cooldown.allowed) {
        const retryAfter = Math.max(1, Math.ceil((cooldown.resetAt - Date.now()) / 1000));
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({
          error: `Yeni kodu ${retryAfter} saniyə sonra istəyə bilərsən.`,
          code: "EMAIL_VERIFICATION_COOLDOWN",
          retryAfter,
        });
      }
      try {
        await sendEmailVerificationCode(user);
      } catch {
        return res.status(503).json({
          error: "Təsdiq kodu hazırda göndərilə bilmədi. Bir neçə dəqiqə sonra yenidən yoxla.",
          code: "EMAIL_DELIVERY_UNAVAILABLE",
        });
      }
    }
    return res.json({ message: "Hesab mövcuddursa, təsdiq kodu e-poçta göndərildi." });
  }));

  router.post("/email-verification/confirm", limit(authStore, "email-verification-confirm", 10, 15 * 60, (req) => normalizeEmail(req.body?.email)), asyncRoute(async (req, res) => {
    const payload = parseBody(EmailVerificationConfirmSchema, req.body);
    await userRepository.purgeExpiredAccounts({ strategyRepository, chatRepository, plannerRepository, aiLearningRepository, authStore });
    const user = await userRepository.findByEmail(payload.email);
    const tokenId = user ? hashOpaqueToken(`${user.id}:${payload.code}`) : hashOpaqueToken(`missing:${payload.code}`);
    const token = await authStore.consumeEmailVerificationToken(tokenId);
    if (!user || !token || token.userId !== user.id) {
      return res.status(400).json({ error: "Təsdiq kodu yanlışdır və ya vaxtı bitib.", code: "INVALID_EMAIL_VERIFICATION_CODE" });
    }
    const verifiedUser = user.emailVerifiedAt
      ? user
      : await userRepository.update(user.id, { emailVerifiedAt: new Date().toISOString() });
    await startSession(req, res, authStore, verifiedUser.id);
    await claimGuestData(req, verifiedUser.id);
    return res.json({ user: publicUser(verifiedUser) });
  }));

  router.post("/login", limit(authStore, "login", 12, 15 * 60, (req) => String(req.body?.identifier || "").toLowerCase()), asyncRoute(async (req, res) => {
    await userRepository.purgeExpiredAccounts({ strategyRepository, chatRepository, plannerRepository, aiLearningRepository, authStore }).catch(() => {});

    const payload = parseBody(LoginSchema, req.body);
    const user = await userRepository.findByIdentifier(payload.identifier);
    const valid = await verifyPassword(user?.passwordHash || DUMMY_PASSWORD_HASH, payload.password);
    if (!user || !valid) {
      return res.status(401).json({
        error: "E-poçt/istifadəçi adı və ya şifrə yanlışdır.",
        code: "INVALID_CREDENTIALS",
      });
    }

    if (!user.emailVerifiedAt) {
      const cooldown = await startEmailVerificationCooldown(req, user.email);
      if (cooldown.allowed) {
        await sendEmailVerificationCode(user).catch(() => {});
      }
      return res.status(403).json({
        error: "Daxil olmaq üçün əvvəlcə e-poçtunu təsdiqlə.",
        code: "EMAIL_VERIFICATION_REQUIRED",
        email: user.email,
        resendAfterSeconds: cooldown.allowed
          ? EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
          : Math.max(1, Math.ceil((cooldown.resetAt - Date.now()) / 1000)),
      });
    }

    let restoredFromPendingDeletion = false;
    let currentUser = user;
    if (user.scheduledDeletionAt) {
      const scheduledTime = new Date(user.scheduledDeletionAt).getTime();
      if (!isNaN(scheduledTime) && scheduledTime <= Date.now()) {
        await userRepository.purgeExpiredAccounts({ strategyRepository, chatRepository, plannerRepository, aiLearningRepository, authStore }).catch(() => {});
        return res.status(401).json({
          error: "Hesabınız 14 günlük gözləmə müddəti bitdiyinə görə tamamilə silinib.",
          code: "ACCOUNT_EXPIRED_DELETED",
        });
      } else {
        currentUser = await userRepository.cancelDeletion(user.id);
        restoredFromPendingDeletion = true;
      }
    }

    await startSession(req, res, authStore, currentUser.id);
    const updated = await userRepository.markLogin(currentUser.id);
    if (req.guestOwnerId && strategyRepository?.claimOwner) {
      await strategyRepository.claimOwner(req.guestOwnerId, currentUser.id);
    }
    if (req.guestOwnerId && chatRepository?.claimOwner) {
      await chatRepository.claimOwner(req.guestOwnerId, currentUser.id);
    }
    if (req.guestOwnerId && plannerRepository?.claimOwner) {
      await plannerRepository.claimOwner(req.guestOwnerId, currentUser.id);
    }
    return res.json({
      user: publicUser(updated || currentUser),
      restoredFromPendingDeletion,
    });
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

  router.post("/account/delete-request", asyncRoute(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    const updated = await userRepository.scheduleDeletion(req.user.id, 14);
    if (req.auth?.sessionId) await authStore.deleteSession(req.auth.sessionId);
    clearSessionCookie(req, res);
    return res.json({
      success: true,
      scheduledDeletionAt: updated.scheduledDeletionAt,
      message: "Hesabınız 14 günlük silinmə rejiminə keçirildi.",
    });
  }));

  router.post("/account/cancel-deletion", asyncRoute(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    const updated = await userRepository.cancelDeletion(req.user.id);
    return res.json({
      success: true,
      user: publicUser(updated),
      message: "Silinmə sorğusu ləğv edildi və hesabınız bərpa olundu.",
    });
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

  router.post("/settings/import-memory", asyncRoute(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    const payload = parseBody(ImportMemoryPayloadSchema, req.body);
    const currentSettings = req.user.settings && typeof req.user.settings === "object" ? req.user.settings : {};
    const currentMemories = Array.isArray(currentSettings.memories) ? currentSettings.memories : [];

    const now = new Date().toISOString();
    const importedMemories = (payload.memories || []).map((m) => ({
      id: m.id || `mem_${randomUUID().slice(0, 8)}`,
      text: m.text,
      category: m.category || "general",
      createdAt: now,
    }));

    let finalMemories = [];
    if (payload.mergeMode === "replace") {
      finalMemories = importedMemories.slice(0, 50);
    } else {
      const existingTexts = new Set(currentMemories.map((m) => m.text.trim().toLowerCase()));
      const newItems = importedMemories.filter((m) => !existingTexts.has(m.text.trim().toLowerCase()));
      finalMemories = [...newItems, ...currentMemories].slice(0, 50);
    }

    const updatedSettings = {
      ...currentSettings,
      personalIntelligence: payload.enablePersonalIntelligence !== false ? true : (currentSettings.personalIntelligence ?? true),
      brandName: payload.brandName !== undefined && payload.brandName !== "" ? payload.brandName : (currentSettings.brandName || ""),
      industry: payload.industry !== undefined && payload.industry !== "" ? payload.industry : (currentSettings.industry || ""),
      primaryMarket: payload.primaryMarket !== undefined && payload.primaryMarket !== "" ? payload.primaryMarket : (currentSettings.primaryMarket || ""),
      targetAudience: payload.targetAudience !== undefined && payload.targetAudience !== "" ? payload.targetAudience : (currentSettings.targetAudience || ""),
      tone: payload.tone || currentSettings.tone || "professional",
      customInstructions: payload.customInstructions !== undefined && payload.customInstructions !== ""
        ? (payload.mergeMode === "merge" && currentSettings.customInstructions && currentSettings.customInstructions !== payload.customInstructions
            ? `${currentSettings.customInstructions}\n\n${payload.customInstructions}`.slice(0, 2000)
            : payload.customInstructions)
        : (currentSettings.customInstructions || ""),
      memories: finalMemories,
    };

    const updated = await userRepository.update(req.user.id, {
      settings: updatedSettings,
    });

    return res.status(200).json({
      ok: true,
      importedCount: importedMemories.length,
      totalMemories: finalMemories.length,
      user: publicUser(updated),
    });
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
  const isAuthRoute = Boolean(
    req.baseUrl?.startsWith("/api/auth") ||
    req.originalUrl?.startsWith("/api/auth") ||
    req.path?.startsWith("/api/auth")
  );
  if (!isAuthRoute) {
    return next(error);
  }
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
