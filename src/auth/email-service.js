import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

export class PasswordResetEmailService {
  constructor({ dataDir, env = process.env } = {}) {
    this.dataDir = dataDir;
    this.env = env;
    this.transport = env.SMTP_HOST
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT || 587),
          secure: String(env.SMTP_SECURE || "false") === "true",
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD || env.SMTP_PASS } : undefined,
        })
      : null;
  }

  async sendPasswordResetEmail({ email, fullName, resetUrl }) {
    const subject = "Marketify şifrəsini yenilə";
    const text = `Salam ${fullName},\n\nMarketify şifrəsini yeniləmək üçün bu keçiddən istifadə et:\n${resetUrl}\n\nKeçid 20 dəqiqə ərzində etibarlıdır və yalnız bir dəfə işləyir. Bu sorğunu sən etməmisənsə, mesajı nəzərə alma.`;
    const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;color:#171b24;font-family:Inter,Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:40px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#fff;border:1px solid #e4e7ec;border-radius:16px"><tr><td style="padding:34px"><div style="font-weight:700;margin-bottom:32px">Marketify</div><h1 style="margin:0 0 12px;font-size:25px;letter-spacing:-.5px">Şifrəni yenilə</h1><p style="margin:0 0 24px;color:#667085;line-height:1.65">Salam ${escapeHtml(fullName)}, Marketify hesabının şifrəsini yeniləmək üçün aşağıdakı düymədən istifadə et.</p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111827;color:#fff;text-decoration:none;font-size:14px;font-weight:600">Şifrəni yenilə</a><p style="margin:24px 0 0;color:#98a2b3;font-size:12px;line-height:1.6">Bu keçid 20 dəqiqə ərzində etibarlıdır və yalnız bir dəfə işləyir. Sorğunu sən etməmisənsə, bu mesajı nəzərə alma.</p></td></tr></table></td></tr></table></body></html>`;
    if (this.transport) {
      await this.transport.sendMail({
        from: this.env.EMAIL_FROM || "Marketify <no-reply@marketify-ai.com>",
        to: email,
        subject,
        text,
        html,
      });
      return;
    }

    if (this.env.NODE_ENV === "production") {
      throw new Error("Password reset email transport is not configured.");
    }

    const outboxPath = path.join(this.dataDir, "email-outbox.json");
    await fs.mkdir(this.dataDir, { recursive: true });
    let outbox = [];
    try { outbox = JSON.parse(await fs.readFile(outboxPath, "utf8")); } catch {}
    outbox.push({ to: email, subject, text, html, createdAt: new Date().toISOString() });
    await fs.writeFile(outboxPath, `${JSON.stringify(outbox, null, 2)}\n`, "utf8");
  }
}
