const app = document.getElementById("mfa-app");
async function init() {
  const res = await fetch("/api/auth/admin-mfa/status");
  if (!res.ok) { app.innerHTML = "<p>Admin icazəsi tapılmadı.</p>"; return; }
  const data = await res.json();
  if (data.verified) { window.location.href = "/"; return; }
  if (data.enrolled) {
    app.innerHTML = `<div class="mfa-card"><h2>Admin MFA Təsdiqi</h2><p>İki faktorlu autentifikasiya kodunu (TOTP) və ya bərpa kodunu daxil edin:</p><form id="mfa-form"><input type="text" id="mfa-code" placeholder="000000" maxlength="32" required autocomplete="one-time-code"><button type="submit" class="primary-button">Təsdiq et</button></form><div id="mfa-msg"></div></div>`;
    document.getElementById("mfa-form").onsubmit = async (e) => {
      e.preventDefault();
      const code = document.getElementById("mfa-code").value.trim();
      const verifyRes = await fetch("/api/auth/admin-mfa/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      if (verifyRes.ok) window.location.href = "/";
      else document.getElementById("mfa-msg").textContent = "Kod yalnışdır və ya vaxtı bitib.";
    };
  } else {
    app.innerHTML = `<div class="mfa-card"><h2>MFA Qeydiyyatı</h2><p>Admin hesabı üçün TOTP qeydiyyatı tələb olunur.</p><form id="setup-form"><input type="password" id="mfa-pw" placeholder="Cari şifrə" required><input type="text" id="mfa-enroll" placeholder="Qeydiyyat tokeni" required><button type="submit" class="primary-button">Quraşdır</button></form><div id="mfa-msg"></div></div>`;
    document.getElementById("setup-form").onsubmit = async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById("mfa-pw").value, enrollmentToken = document.getElementById("mfa-enroll").value.trim();
      const setupRes = await fetch("/api/auth/admin-mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, enrollmentToken }) });
      const setupData = await setupRes.json();
      if (!setupRes.ok) { document.getElementById("mfa-msg").textContent = setupData.error || "Qeydiyyat xətası"; return; }
      app.innerHTML = `<div class="mfa-card"><h2>TOTP Quraşdırma</h2><p>Gizli açar: <code>${setupData.secret}</code></p><p>Authenticator tətbiqində kodu daxil edib təsdiqləyin:</p><form id="confirm-form"><input type="text" id="confirm-code" placeholder="6 rəqəmli kod" maxlength="6" required><button type="submit" class="primary-button">Tamamla</button></form></div>`;
      document.getElementById("confirm-form").onsubmit = async (ev) => {
        ev.preventDefault();
        const confRes = await fetch("/api/auth/admin-mfa/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setupToken: setupData.setupToken, code: document.getElementById("confirm-code").value.trim() }) });
        const confData = await confRes.json();
        if (!confRes.ok) {
          alert(confData.error || "Təsdiq xətası");
          return;
        }
        if (Array.isArray(confData.recoveryCodes) && confData.recoveryCodes.length) {
          app.innerHTML = `<div class="mfa-card"><h2>MFA Qeydiyyatı Tamamlandı</h2><p style="color:#ef4444;font-weight:600;">DİQQƏT: Aşağıdakı bərpa kodlarını təhlükəsiz yerdə saxlayın. Authenticator itirildikdə hesabınızı yalnız bu kodlarla bərpa edə bilərsiniz:</p><pre style="background:#1e293b;color:#f8fafc;padding:12px;border-radius:6px;user-select:all;font-family:monospace;margin:12px 0;">${confData.recoveryCodes.join("\n")}</pre><button id="mfa-done-btn" class="primary-button">Kodları Saxladım, Davam Et</button></div>`;
          document.getElementById("mfa-done-btn").onclick = () => { window.location.href = "/"; };
        } else {
          window.location.href = "/";
        }
      };
    };
  }
}
init();
