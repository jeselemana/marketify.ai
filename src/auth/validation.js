import { z } from "zod";

const RESERVED_USERNAMES = new Set([
  "account", "admin", "administrator", "api", "app", "auth", "billing", "dashboard",
  "help", "login", "logout", "marketify", "register", "root", "security", "settings",
  "signup", "support", "system", "www",
]);

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

const UsernameSchema = z
  .string()
  .trim()
  .min(3, "İstifadəçi adı ən azı 3 simvol olmalıdır.")
  .max(30, "İstifadəçi adı 30 simvoldan uzun ola bilməz.")
  .regex(/^[a-zA-Z0-9._]+$/, "Yalnız hərf, rəqəm, nöqtə və alt xətdən istifadə et.")
  .transform(normalizeUsername)
  .refine((value) => !value.startsWith(".") && !value.endsWith("."), "İstifadəçi adı nöqtə ilə başlaya və ya bitə bilməz.")
  .refine((value) => !value.includes(".."), "Ardıcıl iki nöqtədən istifadə etmək olmaz.")
  .refine((value) => !RESERVED_USERNAMES.has(value), "Bu istifadəçi adı rezerv edilib.");

const PasswordSchema = z
  .string()
  .min(10, "Şifrə ən azı 10 simvol olmalıdır.")
  .max(128, "Şifrə 128 simvoldan uzun ola bilməz.")
  .regex(/[a-zA-Z]/, "Şifrədə ən azı bir hərf olmalıdır.")
  .regex(/[0-9]/, "Şifrədə ən azı bir rəqəm olmalıdır.");

export const SignupSchema = z.object({
  fullName: z.string().trim().min(2, "Ad və soyadı daxil et.").max(80),
  username: z.string().trim().transform((val) => val.replace(/^@+/, "")).pipe(UsernameSchema),
  email: z.string().trim().email("Düzgün e-poçt ünvanı daxil et.").max(254).transform(normalizeEmail),
  password: PasswordSchema,
});

export const LoginSchema = z.object({
  identifier: z.string().trim().min(1, "E-poçt və ya istifadəçi adını daxil et.").max(254),
  password: z.string().min(1, "Şifrəni daxil et.").max(128),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Cari şifrəni daxil et.").max(128),
  newPassword: PasswordSchema,
});

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().email("Düzgün e-poçt ünvanı daxil et.").max(254).transform(normalizeEmail),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(32).max(512),
  password: PasswordSchema,
});

export const EmailVerificationRequestSchema = z.object({
  email: z.string().trim().email("Düzgün e-poçt ünvanı daxil et.").max(254).transform(normalizeEmail),
});

export const EmailVerificationConfirmSchema = EmailVerificationRequestSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/, "6 rəqəmli təsdiq kodunu daxil et."),
});

export const AccountUpdateSchema = z.object({
  fullName: z.string().trim().min(2, "Ad və soyadı daxil et.").max(80),
  username: z.string().trim().transform((val) => val.replace(/^@+/, "")).pipe(UsernameSchema),
  email: z.string().trim().email("Düzgün e-poçt ünvanı daxil et.").max(254).transform(normalizeEmail),
});

export const OnboardingSchema = z.object({
  focus: z.enum(["business", "campaign", "brand", "research", "other"]),
});

/**
 * Detects sensitive personal data (phone numbers, residential addresses, payment info,
 * identification codes, passwords) in user memory text.
 * @param {string} text
 * @returns {{ isSensitive: boolean, reason?: string }}
 */
export function detectSensitiveInformation(text) {
  if (!text || typeof text !== "string") {
    return { isSensitive: false };
  }
  const clean = text.trim();

  // 1. Phone numbers (Azerbaijani + International formats)
  const phonePatterns = [
    /(?:\+994|00994|994)?[\s.-]?(?:0?(?:10|50|51|55|60|70|77|99|12|18|20|21|22|23|24|25|26|36))[\s.-]?[0-9]{3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/i,
    /(?:\btelefon|\bnömrə|\bnömrəm|\bmobil|\bwhatsapp|\bəlaqə|\bphone|\bcall|\btel)[\s:]*[\s.-]?(?:\+?[0-9]{1,4}[\s.-]?)?[0-9]{5,12}/i,
    /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2,4}/,
    /\b0[1-9][0-9]{8}\b/,
  ];

  for (const regex of phonePatterns) {
    if (regex.test(clean)) {
      return {
        isSensitive: true,
        reason: "Yaddaşda telefon və ya mobil nömrələrin saxlanılmasına icazə verilmir.",
      };
    }
  }

  // 2. Residential addresses / Yaşayış və ev ünvanları
  const addressKeywords = [
    /(?:yaşayış\s*ünvanı|ev\s*ünvanı|ev\s*ünvanım|yaşayış\s*yeri|evimin\s*ünvanı|qeydiyyat\s*ünvanı)/i,
    /(?:residential\s*address|home\s*address|living\s*address|apartment\s*address)/i,
    /(?:küç(?:əsi|\.)|prospekt(?:i|\.)|pr\.|döngə(?:si|\.)|dalan(?:ı|\.))\s*(?:[0-9]+|[A-ZƏÖĞÇŞÜa-zəöğçşü]+)\s*,?\s*(?:ev|bina|mənzil|blok|korpus|mərtəbə)\s*[0-9]+/i,
    /(?:ev|bina|korpus)\s*[0-9]+\s*,\s*mənzil\s*[0-9]+/i,
    /(?:mənzil\s*no|mənzil\s*№|mənzil\s*nömrəsi|apt\s*#|apt\s*no)\s*[0-9]+/i,
    /(?:yaşayıram|yaşayırıq)\s*:\s*.+/i,
  ];

  for (const regex of addressKeywords) {
    if (regex.test(clean)) {
      return {
        isSensitive: true,
        reason: "Yaddaşda dəqiq yaşayış və ya ev ünvanlarının saxlanılmasına icazə verilmir.",
      };
    }
  }

  // 3. Payment cards / CVV / Bank accounts
  const paymentPatterns = [
    /\b(?:\d{4}[ -]?){3}\d{4}\b/,
    /\b(?:cvv|cvc|cvv2|cvc2)(?:\s*(?:kodu?m?|code))?[\s:=]*[0-9]{3,4}\b/i,
    /\bAZ\d{2}[A-Z0-9]{24}\b/i,
    /(?:kart\s*nömrəsi|hesab\s*nömrəsi|kredit\s*kartı|bank\s*kartı)[\s:]*[0-9]{8,20}/i,
  ];

  for (const regex of paymentPatterns) {
    if (regex.test(clean)) {
      return {
        isSensitive: true,
        reason: "Yaddaşda bank kartı, CVV və ya hesab məlumatlarının saxlanılmasına icazə verilmir.",
      };
    }
  }

  // 4. Identification & Official IDs (FİN kod, ŞV seriyası, Pasport, SSN)
  const idPatterns = [
    /(?:fin(?:\s*kodu?m?)?|f[iİ]n|şv(?:\s*seriya(?:sı)?)?|şəxsiyyət\s*vəsiqəsi|pasport(?:\s*nömrəsi)?|pin(?:\s*code|\s*kodu?m?)?|ssn)[\s:=]*[a-zA-Z0-9]{6,10}/i,
    /\b(?:AZE|AA)\s*[0-9]{7,8}\b/i,
  ];

  for (const regex of idPatterns) {
    if (regex.test(clean)) {
      return {
        isSensitive: true,
        reason: "Yaddaşda FİN kod, şəxsiyyət vəsiqəsi və ya pasport məlumatlarının saxlanılmasına icazə verilmir.",
      };
    }
  }

  // 5. Passwords / Secrets / API Keys
  const secretPatterns = [
    /(?:şifrə(?:m)?|parol(?:um)?|password|api[_-]?key|secret[_-]?key|token|auth[_-]?token)[\s:=]+[\S]{4,}/i,
  ];

  for (const regex of secretPatterns) {
    if (regex.test(clean)) {
      return {
        isSensitive: true,
        reason: "Yaddaşda şifrə, API açarı və ya məxfi tokenlərin saxlanılmasına icazə verilmir.",
      };
    }
  }

  return { isSensitive: false };
}

export const UserMemoryItemSchema = z.object({
  id: z.string().trim().min(1).max(100),
  text: z
    .string()
    .trim()
    .min(1, "Yaddaş mətni boş ola bilməz.")
    .max(500, "Yaddaş mətni 500 simvoldan çox ola bilməz.")
    .refine((text) => !detectSensitiveInformation(text).isSensitive, (text) => ({
      message: detectSensitiveInformation(text).reason || "Yaddaşda həssas şəxsi məlumatların saxlanılmasına icazə verilmir.",
    })),
  category: z.enum(["business", "audience", "preference", "constraint", "general"]).default("general"),
  createdAt: z.string().max(80),
});

export const AddMemoryItemSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Qeyd daxil edin.")
    .max(500, "Qeyd 500 simvoldan uzun ola bilməz.")
    .refine((text) => !detectSensitiveInformation(text).isSensitive, (text) => ({
      message: detectSensitiveInformation(text).reason || "Yaddaşda həssas şəxsi məlumatların saxlanılmasına icazə verilmir.",
    })),
  category: z.enum(["business", "audience", "preference", "constraint", "general"]).optional().default("general"),
});

export const UserSettingsSchema = z.object({
  personalIntelligence: z.boolean().optional(),
  brandName: z.string().trim().max(100, "Brend adı 100 simvoldan uzun ola bilməz.").optional().default(""),
  industry: z.string().trim().max(100, "Sənaye sahəsi 100 simvoldan uzun ola bilməz.").optional().default(""),
  targetAudience: z.string().trim().max(500, "Hədəf kütlə 500 simvoldan uzun ola bilməz.").optional().default(""),
  primaryMarket: z.string().trim().max(100, "Bazar məlumatı 100 simvoldan uzun ola bilməz.").optional().default(""),
  tone: z.enum(["professional", "creative", "concise", "friendly", "data_driven"]).optional().default("professional"),
  customInstructions: z.string().trim().max(2000, "Xüsusi təlimatlar 2000 simvoldan uzun ola bilməz.").optional().default(""),
  memories: z.array(UserMemoryItemSchema).max(50, "Maksimum 50 yaddaş qeydi saxlanıla bilər.").optional(),
  autoContext: z.boolean().optional().default(true),
  strategyPersonalization: z.boolean().optional().default(true),
  defaultMode: z.enum(["build", "ask"]).optional().default("build"),
});

export const ImportedMemoryItemSchema = z.object({
  id: z.string().trim().max(100).optional(),
  text: z
    .string()
    .trim()
    .min(1, "Qeyd daxil edin.")
    .max(500, "Qeyd 500 simvoldan uzun ola bilməz.")
    .refine((text) => !detectSensitiveInformation(text).isSensitive, (text) => ({
      message: detectSensitiveInformation(text).reason || "Yaddaşda həssas şəxsi məlumatların saxlanılmasına icazə verilmir.",
    })),
  category: z.enum(["business", "audience", "preference", "constraint", "general"]).optional().default("general"),
});

export const ImportMemoryPayloadSchema = z.object({
  brandName: z.string().trim().max(100, "Brend adı 100 simvoldan uzun ola bilməz.").optional().default(""),
  industry: z.string().trim().max(100, "Sənaye sahəsi 100 simvoldan uzun ola bilməz.").optional().default(""),
  targetAudience: z.string().trim().max(500, "Hədəf kütlə 500 simvoldan uzun ola bilməz.").optional().default(""),
  primaryMarket: z.string().trim().max(100, "Bazar məlumatı 100 simvoldan uzun ola bilməz.").optional().default(""),
  tone: z.enum(["professional", "creative", "concise", "friendly", "data_driven"]).optional().default("professional"),
  customInstructions: z.string().trim().max(2000, "Xüsusi təlimatlar 2000 simvoldan uzun ola bilməz.").optional().default(""),
  memories: z.array(ImportedMemoryItemSchema).max(50, "Maksimum 50 yaddaş qeydi saxlanıla bilər.").optional().default([]),
  mergeMode: z.enum(["merge", "replace"]).optional().default("merge"),
  enablePersonalIntelligence: z.boolean().optional().default(true),
});

export function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const error = new Error(result.error.issues[0]?.message || "Məlumatları yoxla.");
  error.code = "VALIDATION_ERROR";
  error.details = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
  throw error;
}

export { UsernameSchema, PasswordSchema };
