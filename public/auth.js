const authRoot = document.querySelector("#authRoot");
const appShell = document.querySelector("#appShell");

const GOOGLE_CLIENT_ID =
  "471975374819-mgn2g8auc7q9eko71air922aoo7h963p.apps.googleusercontent.com";

const AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

let pendingReturnPath = "/";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}



function safeInternalPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, location.origin);
    if (url.origin !== location.origin || AUTH_PATHS.has(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && data.code === "AUTH_REQUIRED" && path !== "/api/auth/me") {
      window.dispatchEvent(new CustomEvent("marketify:auth-required"));
    }
    const error = new Error(data.error || "Sorğunu tamamlamaq mümkün olmadı.");
    error.code = data.code;
    error.field = data.field;
    error.details = data.details;
    error.email = data.email;
    error.resendAfterSeconds = data.resendAfterSeconds || data.retryAfter;
    throw error;
  }
  return data;
}

function route(path, replace = false) {
  window.history[replace ? "replaceState" : "pushState"]({}, "", path);
}

function shell(title, subtitle) {
  authRoot.replaceChildren();
  const layout = document.createElement("div");
  layout.className = "auth-layout";
  layout.innerHTML = `
    <section class="auth-story" aria-label="Marketify">
      <div class="auth-story-bg-glow"></div>
      <div class="auth-story-header">
        <a class="auth-brand" href="/login">
          <div class="auth-brand-info">
            <strong>Marketify</strong>
          </div>
        </a>
      </div>

      <div class="auth-story-body">
        <div class="auth-brand-statement">
          <h2>Düşündüyün strategiyanın<br>icrasına başla.</h2>
          <p class="auth-brand-subtext">AI-powered strategy workspace</p>
        </div>
      </div>

      <div class="auth-story-footer">
        <span class="auth-story-copyright">© Innova Group Azerbaijan</span>
      </div>
    </section>

    <section class="auth-panel">
      <div class="auth-container">
        <div class="auth-mobile-header">
          <a class="auth-brand" href="/login">
            <div class="auth-brand-info">
              <strong>Marketify</strong>
            </div>
          </a>
        </div>

        <div class="auth-header">
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
        </div>

        <div class="auth-content"></div>
      </div>
    </section>`;
  authRoot.appendChild(layout);
  return layout.querySelector(".auth-content");
}

function field({ label, name, type = "text", autocomplete, placeholder = "", hint = "" }) {
  const wrapper = document.createElement("label");
  wrapper.className = "auth-field";
  wrapper.innerHTML = `
    <span class="auth-field-label">${label}</span>
    <span class="auth-input-wrap">
      <input name="${name}" type="${type}" autocomplete="${autocomplete || "off"}" placeholder="${placeholder}" required />
      <button class="password-toggle" type="button" aria-label="Şifrəni göstər" ${type === "password" ? "" : "hidden"}>
        <svg class="icon-eye" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </span>
    <small class="auth-field-hint">${hint}</small>
  `;
  const input = wrapper.querySelector("input");
  input.setAttribute("aria-label", label);
  const toggle = wrapper.querySelector(".password-toggle");
  if (type === "password") {
    toggle.addEventListener("click", () => {
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      toggle.setAttribute("aria-label", visible ? "Şifrəni göstər" : "Şifrəni gizlət");
      toggle.innerHTML = visible
        ? `<svg class="icon-eye" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg class="icon-eye-off" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;
    });
  }
  return wrapper;
}

function setFormError(form, message, fieldName = "") {
  form.querySelectorAll(".auth-field").forEach((item) => item.classList.remove("has-error"));
  const box = form.querySelector(".auth-error");
  box.textContent = message || "";
  box.hidden = !message;
  if (fieldName) form.elements[fieldName]?.closest(".auth-field")?.classList.add("has-error");
}

function submitState(button, pending, label) {
  button.disabled = pending;
  button.innerHTML = pending ? `<span class="auth-spinner" aria-hidden="true"></span>Gözlə…` : label;
}

function formBase(actionLabel) {
  const form = document.createElement("form");
  form.className = "auth-form";
  form.innerHTML = `<div class="auth-error" role="alert" hidden></div>`;
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "auth-submit";
  submit.textContent = actionLabel;
  return { form, submit };
}

function linkButton(label, path) {
  const link = document.createElement("a");
  link.href = path;
  link.textContent = label;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    route(path);
    renderRoute();
  });
  return link;
}

let authenticatedCallback = null;

async function enterGuestWorkspace() {
  authRoot.hidden = true;
  appShell.hidden = false;
  document.body.classList.remove("auth-loading", "auth-active");
  route(pendingReturnPath, true);
  await authenticatedCallback?.(null);
}

function guestAccessButton(label = "Hesabsız davam et") {
  const wrap = document.createElement("div");
  wrap.className = "auth-guest-wrap";
  const guest = document.createElement("button");
  guest.type = "button";
  guest.className = "auth-guest-link";
  guest.innerHTML = `
    <span>${escapeHtml(label)}</span>
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  `;
  guest.addEventListener("click", enterGuestWorkspace);
  wrap.appendChild(guest);
  return wrap;
}

async function completeAuthentication(user) {
  if (!user.onboardingCompleted) return renderOnboarding(user);
  authRoot.hidden = true;
  appShell.hidden = false;
  document.body.classList.remove("auth-loading", "auth-active");
  route(pendingReturnPath, true);
  await authenticatedCallback?.(user);
}

async function handleGoogleCredential(response) {
  try {
    const data = await request("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({
        credential: response.credential,
      }),
    });

    if (data.restoredFromPendingDeletion) {
      window.dispatchEvent(new CustomEvent("marketify:account-restored"));
    }
    await completeAuthentication(data.user);
  } catch (error) {
    console.error("Google login xətası:", error);
    const form = authRoot.querySelector(".auth-form");
    if (form) setFormError(form, error.message);
  }
}

function googleSignInButton() {
  const wrapper = document.createElement("div");
  wrapper.className = "google-auth-wrapper";

  const target = document.createElement("div");
  target.className = "google-auth-button";

  wrapper.appendChild(target);

  const renderGoogleButton = () => {
    if (!window.google?.accounts?.id) {
      setTimeout(renderGoogleButton, 100);
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      ux_mode: "popup",
    });

    google.accounts.id.renderButton(target, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 380,
    });
  };

  requestAnimationFrame(renderGoogleButton);

  return wrapper;
}

function renderLogin() {
  document.title = "Daxil ol — Marketify";

  const content = shell(
    "Daxil ol",
    "Strategiyalarına davam etmək üçün daxil ol."
  );

  const { form, submit } = formBase("Daxil ol");

  form.append(
    field({
      label: "E-poçt və ya istifadəçi adı",
      name: "identifier",
      autocomplete: "username",
      placeholder: "ad@sirket.az və ya username",
    }),
    field({
      label: "Şifrə",
      name: "password",
      type: "password",
      autocomplete: "current-password",
      placeholder: "Şifrən",
    }),
  );

  const helpers = document.createElement("div");
  helpers.className = "auth-form-helpers";
  helpers.append(
    document.createElement("span"),
    linkButton("Şifrəni unutmusansa", "/forgot-password"),
  );

  form.append(helpers, submit);

  const divider = document.createElement("div");
  divider.className = "auth-divider";
  divider.innerHTML = "<span>və ya</span>";

  form.append(
    divider,
    googleSignInButton(),
  );

  const switcher = document.createElement("p");
  switcher.className = "auth-switch";
  switcher.append(
    "Hesabın yoxdur? ",
    linkButton("Pulsuz hesab yarat", "/signup"),
  );

  form.append(
    switcher,
    guestAccessButton("Hesabsız davam et"),
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    setFormError(form, "");
    submitState(submit, true, "Daxil ol");

    try {
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: form.identifier.value,
          password: form.password.value,
        }),
      });

      if (data.restoredFromPendingDeletion) {
        window.dispatchEvent(new CustomEvent("marketify:account-restored"));
      }
      await completeAuthentication(data.user);
    } catch (error) {
      if (error.code === "EMAIL_VERIFICATION_REQUIRED" && error.email) {
        route(`/verify-email?email=${encodeURIComponent(error.email)}&cooldown=${encodeURIComponent(error.resendAfterSeconds || 0)}`);
        renderRoute();
        return;
      }
      setFormError(form, error.message);
      submitState(submit, false, "Daxil ol");
    }
  });

  content.appendChild(form);

  setTimeout(() => form.identifier.focus(), 0);
}
function renderSignup() {
  document.title = "Hesabını yarat — Marketify";
  const content = shell("Hesabını yarat", "Marketify workspace-inə başlamaq üçün hesab yarat.");
  const { form, submit } = formBase("Hesab yarat");
  const fullName = field({ label: "Ad və soyad", name: "fullName", autocomplete: "name", placeholder: "Ad və Soyad" });
  const username = field({ label: "İstifadəçi adı", name: "username", autocomplete: "username", placeholder: "marketoloq" });
  username.classList.add("auth-username-field");
  const usernamePrefix = document.createElement("span");
  usernamePrefix.className = "auth-username-prefix";
  usernamePrefix.textContent = "@";
  username.querySelector(".auth-input-wrap").prepend(usernamePrefix);
  const email = field({ label: "E-poçt", name: "email", type: "email", autocomplete: "email", placeholder: "ad@sirket.az" });
  const password = field({ label: "Şifrə", name: "password", type: "password", autocomplete: "new-password", placeholder: "Ən azı 10 simvol" });
  form.append(fullName, username, email, password, submit);

  const divider = document.createElement("div");
  divider.className = "auth-divider";
  divider.innerHTML = "<span>və ya</span>";

  form.append(
    divider,
    googleSignInButton(),
  );
  const availability = username.querySelector("small");
  let timer;
  let isUsernameAvailable = null;
  form.username.addEventListener("input", () => {
    clearTimeout(timer);
    const clean = form.username.value.trim().replace(/^@+/, "");
    if (!clean) {
      availability.className = "auth-field-hint";
      availability.textContent = "";
      isUsernameAvailable = null;
      return;
    }
    availability.className = "auth-field-hint";
    availability.textContent = "Yoxlanılır…";
    timer = setTimeout(async () => {
      try {
        const data = await request(`/api/auth/username-availability?username=${encodeURIComponent(clean)}`);
        if (!data.valid) {
          availability.textContent = data.error || "3–30 simvol · hərf, rəqəm, nöqtə və alt xətt";
          availability.className = "auth-field-hint is-invalid";
          isUsernameAvailable = false;
        } else if (data.available) {
          availability.textContent = `@${clean.toLowerCase()} istifadəyə uyğundur`;
          availability.className = "auth-field-hint is-valid";
          isUsernameAvailable = true;
        } else {
          availability.textContent = "Bu istifadəçi adı artıq götürülüb";
          availability.className = "auth-field-hint is-invalid";
          isUsernameAvailable = false;
        }
      } catch {
        availability.textContent = "";
      }
    }, 250);
  });

  const switcher = document.createElement("p");
  switcher.className = "auth-switch";
  switcher.append("Artıq hesabın var? ", linkButton("Daxil ol", "/login"));

  const terms = document.createElement("p");
  terms.className = "auth-terms";
  terms.textContent = "Davam etməklə Marketify-in istifadə və məxfilik şərtlərini qəbul edirsən.";

  form.append(switcher, guestAccessButton("Hesabsız davam et"), terms);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isUsernameAvailable === false) {
      setFormError(form, "Bu istifadəçi adı artıq götürülüb. Başqa ad seç.", "username");
      return;
    }
    setFormError(form, "");
    submitState(submit, true, "Hesab yarat");
    
    try {
      const formData = Object.fromEntries(new FormData(form));
      formData.username = String(formData.username || "").trim().replace(/^@+/, "");
      const data = await request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      if (data.verificationRequired && data.email) {
        const delivery = data.deliveryPending ? "&delivery=pending" : "";
        const cooldown = `&cooldown=${encodeURIComponent(data.resendAfterSeconds || 0)}`;
        route(`/verify-email?email=${encodeURIComponent(data.email)}${delivery}${cooldown}`);
        renderRoute();
        return;
      }
      throw new Error("Təsdiq prosesini başlatmaq mümkün olmadı.");
    } catch (error) {
      setFormError(form, error.message, error.field);
      submitState(submit, false, "Hesab yarat");
    }
  });
  content.appendChild(form);
  setTimeout(() => form.fullName.focus(), 0);
}

function renderEmailVerification() {
  document.title = "E-poçtu təsdiqlə — Marketify";
  const email = new URLSearchParams(location.search).get("email") || "";
  const deliveryPending = new URLSearchParams(location.search).get("delivery") === "pending";
  const requestedCooldown = Number(new URLSearchParams(location.search).get("cooldown"));
  const content = shell("E-poçtunu təsdiqlə", "E-poçtuna göndərilən 6 rəqəmli kodu daxil et.");
  const { form, submit } = formBase("Təsdiqlə və davam et");
  const emailField = field({ label: "E-poçt", name: "email", type: "email", autocomplete: "email", placeholder: "ad@sirket.az" });
  emailField.querySelector("input").value = email;
  const codeField = field({ label: "Təsdiq kodu", name: "code", autocomplete: "one-time-code", placeholder: "123456", hint: "Kod 10 dəqiqə ərzində etibarlıdır." });
  const codeInput = codeField.querySelector("input");
  codeInput.inputMode = "numeric";
  codeInput.maxLength = 6;
  codeInput.pattern = "[0-9]{6}";
  form.append(emailField, codeField, submit);

  const resend = document.createElement("button");
  resend.type = "button";
  resend.className = "auth-resend-button";
  const resendHint = document.createElement("span");
  resendHint.className = "auth-resend-hint";
  const startResendCooldown = (seconds = 60) => {
    const endsAt = Date.now() + Math.max(0, seconds) * 1000;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      const minutes = Math.floor(remaining / 60);
      const secondsPart = remaining % 60;
      resend.disabled = remaining > 0;
      resend.textContent = remaining > 0 ? `Kodu yenidən göndər · ${minutes}:${String(secondsPart).padStart(2, "0")}` : "Kodu yenidən göndər";
      resendHint.textContent = remaining > 0 ? "Yeni kod üçün qısa gözləmə" : "Kod gəlməyibsə, yenidən göndər.";
      if (remaining > 0) window.setTimeout(update, 1000);
    };
    update();
  };
  startResendCooldown(Number.isFinite(requestedCooldown) ? Math.min(60, Math.max(0, requestedCooldown)) : 0);
  resend.addEventListener("click", async () => {
    setFormError(form, "");
    resend.disabled = true;
    try {
      const data = await request("/api/auth/email-verification/resend", {
        method: "POST",
        body: JSON.stringify({ email: form.email.value }),
      });
      resendHint.textContent = data.message || "Yeni kod e-poçtuna göndərildi.";
      startResendCooldown(60);
    } catch (error) {
      if (error.code === "EMAIL_VERIFICATION_COOLDOWN") {
        startResendCooldown(error.resendAfterSeconds || 60);
      } else {
        setFormError(form, error.message, "email");
        resend.disabled = false;
      }
    }
  });
  const resendWrap = document.createElement("div");
  resendWrap.className = "auth-resend";
  resendWrap.append(resend, resendHint);
  const switcher = document.createElement("div");
  switcher.className = "auth-switch";
  switcher.append(resendWrap, linkButton("Daxil olmağa qayıt", "/login"));
  form.append(switcher);
  if (deliveryPending) {
    setFormError(form, "Hesab yaradıldı, amma kod göndərilmədi. Aşağıdakı düymə ilə yenidən göndər.");
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormError(form, "");
    if (!/^\d{6}$/.test(form.code.value.trim())) return setFormError(form, "6 rəqəmli təsdiq kodunu daxil et.", "code");
    submitState(submit, true, "Təsdiqlənir…");
    try {
      const data = await request("/api/auth/email-verification/confirm", {
        method: "POST",
        body: JSON.stringify({ email: form.email.value, code: form.code.value.trim() }),
      });
      await completeAuthentication(data.user);
    } catch (error) {
      setFormError(form, error.message, error.code === "INVALID_EMAIL_VERIFICATION_CODE" ? "code" : "email");
      submitState(submit, false, "Təsdiqlə və davam et");
    }
  });
  content.appendChild(form);
  setTimeout(() => (email ? codeInput : form.email).focus(), 0);
}

function renderForgot() {
  document.title = "Şifrəni bərpa et — Marketify";
  const content = shell("Şifrəni bərpa et", "E-poçtunu daxil et, bərpa keçidi göndərək.");
  const { form, submit } = formBase("Keçid göndər");
  form.append(field({ label: "E-poçt", name: "email", type: "email", autocomplete: "email", placeholder: "ad@sirket.az" }), submit);
  const back = document.createElement("p");
  back.className = "auth-switch";
  back.append(linkButton("← Daxil olmağa qayıt", "/login"));
  form.append(back);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitState(submit, true, "Keçid göndər");
    try {
      const data = await request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: form.email.value }) });
      form.replaceChildren();
      const done = document.createElement("div");
      done.className = "auth-success";
      done.innerHTML = `<span>✓</span><h3>E-poçtunu yoxla</h3><p>${data.message}</p>`;
      done.appendChild(linkButton("Daxil olmağa qayıt", "/login"));
      form.appendChild(done);
    } catch (error) {
      setFormError(form, error.message);
      submitState(submit, false, "Keçid göndər");
    }
  });
  content.appendChild(form);
}

function renderReset() {
  document.title = "Yeni şifrə — Marketify";
  const content = shell("Yeni şifrə", "Hesabın üçün yeni güclü şifrə təyin et.");
  const token = new URLSearchParams(location.search).get("token") || "";
  const { form, submit } = formBase("Şifrəni yenilə");
  form.append(
    field({ label: "Yeni şifrə", name: "password", type: "password", autocomplete: "new-password", placeholder: "Ən azı 10 simvol", hint: "Ən azı 10 simvol, bir hərf və bir rəqəm" }),
    field({ label: "Yeni şifrəni təsdiqlə", name: "confirmPassword", type: "password", autocomplete: "new-password", placeholder: "Yeni şifrəni təkrar yaz" }),
    submit,
  );
  const newLink = document.createElement("p");
  newLink.className = "auth-switch";
  newLink.append(linkButton("Yeni bərpa keçidi istə", "/forgot-password"));
  form.appendChild(newLink);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormError(form, "");
    if (form.password.value !== form.confirmPassword.value) {
      return setFormError(form, "Yeni şifrələr eyni deyil.", "confirmPassword");
    }
    submitState(submit, true, "Şifrəni yenilə");
    try {
      await request("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password: form.password.value }) });
      form.replaceChildren();
      const done = document.createElement("div");
      done.className = "auth-success";
      done.innerHTML = "<span>✓</span><h3>Şifrə yeniləndi</h3><p>İndi yeni şifrənlə hesabına daxil ola bilərsən.</p>";
      done.appendChild(linkButton("Daxil ol", "/login"));
      form.appendChild(done);
    } catch (error) {
      setFormError(form, error.message);
      submitState(submit, false, "Şifrəni yenilə");
    }
  });
  content.appendChild(form);
}

function renderOnboarding(user) {
  document.title = "Marketify-ni hazırla";
  document.body.classList.add("auth-active");
  const content = shell(`Salam, ${user.fullName.split(" ")[0]}`, "Marketify-ni işinə uyğunlaşdırmaq üçün əsas fokusunu seç.");
  const form = document.createElement("form");
  form.className = "onboarding-form";
  form.innerHTML = `<div class="auth-error" role="alert" hidden></div><div class="onboarding-options">
    <label><input type="radio" name="focus" value="business" checked><span><strong>Biznes strategiyası</strong><small>Mövqelənmə, böyümə və icra planı</small></span></label>
    <label><input type="radio" name="focus" value="campaign"><span><strong>Kampaniya</strong><small>Launch və marketinq kampaniyaları</small></span></label>
    <label><input type="radio" name="focus" value="brand"><span><strong>Brend</strong><small>Auditoriya, mesaj və brend istiqaməti</small></span></label>
    <label><input type="radio" name="focus" value="research"><span><strong>Araşdırma</strong><small>Bazar, rəqib və qərar dəstəyi</small></span></label>
  </div>`;
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "auth-submit";
  submit.textContent = "Workspace-ə keç";
  form.appendChild(submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitState(submit, true, "Workspace-ə keç");
    try {
      const data = await request("/api/auth/onboarding", { method: "POST", body: JSON.stringify({ focus: form.focus.value }) });
      await completeAuthentication(data.user);
    } catch (error) {
      setFormError(form, error.message);
      submitState(submit, false, "Workspace-ə keç");
    }
  });
  content.appendChild(form);
}

function renderRoute() {
  appShell.hidden = true;
  authRoot.hidden = false;
  document.body.classList.remove("auth-loading");
  document.body.classList.add("auth-active");
  const path = location.pathname;
  if (path === "/signup") return renderSignup();
  if (path === "/forgot-password") return renderForgot();
  if (path === "/reset-password") return renderReset();
  if (path === "/verify-email") return renderEmailVerification();
  if (path !== "/login") route("/login", true);
  return renderLogin();
}

export async function initializeAuthentication(onAuthenticated) {
  authenticatedCallback = onAuthenticated;
  const requestedReturn = new URLSearchParams(location.search).get("returnTo");
  pendingReturnPath = requestedReturn
    ? safeInternalPath(requestedReturn)
    : AUTH_PATHS.has(location.pathname)
      ? "/"
      : safeInternalPath(`${location.pathname}${location.search}${location.hash}`);
  window.addEventListener("popstate", renderRoute);
  window.addEventListener("marketify:auth-required", () => {
    pendingReturnPath = safeInternalPath(`${location.pathname}${location.search}${location.hash}`);
    route(`/login?returnTo=${encodeURIComponent(pendingReturnPath)}`, true);
    renderRoute();
  });
  if (AUTH_PATHS.has(location.pathname)) {
    renderRoute();
    return;
  }
  try {
    const data = await request("/api/auth/me");
    await completeAuthentication(data.user);
  } catch {
    await enterGuestWorkspace();
  }
}

export async function logout() {
  await request("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
  route("/login", true);
  renderRoute();
}

export { request as authRequest };
