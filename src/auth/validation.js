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
  username: UsernameSchema,
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

export const AccountUpdateSchema = z.object({
  fullName: z.string().trim().min(2, "Ad və soyadı daxil et.").max(80),
  username: UsernameSchema,
  email: z.string().trim().email("Düzgün e-poçt ünvanı daxil et.").max(254).transform(normalizeEmail),
});

export const OnboardingSchema = z.object({
  focus: z.enum(["business", "campaign", "brand", "research", "other"]),
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
