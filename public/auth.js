import { t, getLanguage, setLanguage } from "./i18n.js";

const authRoot = document.querySelector("#authRoot");
const appShell = document.querySelector("#appShell");

const DEFAULT_GOOGLE_CLIENT_ID =
  "471975374819-mgn2g8auc7q9eko71air922aoo7h963p.apps.googleusercontent.com";
let runtimeGoogleClientId = DEFAULT_GOOGLE_CLIENT_ID;

async function loadAuthConfig() {
  try {
    const data = await request("/api/auth/config");
    if (data?.googleClientId) {
      runtimeGoogleClientId = data.googleClientId;
    }
  } catch {}
}

const AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

let pendingReturnPath = "/workspace";

function openLegalDoc(type) {
  window.dispatchEvent(new CustomEvent("marketify:open-legal", { detail: { type } }));
}

function legalNoticeElement() {
  const terms = document.createElement("p");
  terms.className = "auth-terms";

  const termsBtn = document.createElement("button");
  termsBtn.type = "button";
  termsBtn.className = "auth-legal-link";
  termsBtn.textContent = t("auth.signup.termsLink");
  termsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openLegalDoc("terms");
  });

  const privacyBtn = document.createElement("button");
  privacyBtn.type = "button";
  privacyBtn.className = "auth-legal-link";
  privacyBtn.textContent = t("auth.signup.privacyLink");
  privacyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openLegalDoc("privacy");
  });

  terms.append(
    t("auth.signup.termsAgreementPre"),
    termsBtn,
    t("auth.signup.and"),
    privacyBtn,
    t("auth.signup.termsAgreementPost")
  );
  return terms;
}

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
    const error = new Error(data.error || t("common.genericError"));
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
          <div class="auth-header-top-row">
            <h1>${escapeHtml(title)}</h1>
          </div>
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
  const eyeLabel = getLanguage() === "en" ? "Show password" : "Şifrəni göstər";
  wrapper.innerHTML = `
    <span class="auth-field-label">${label}</span>
    <span class="auth-input-wrap">
      <input name="${name}" type="${type}" autocomplete="${autocomplete || "off"}" placeholder="${placeholder}" required />
      <button class="password-toggle" type="button" aria-label="${eyeLabel}" ${type === "password" ? "" : "hidden"}>
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
      const isEn = getLanguage() === "en";
      toggle.setAttribute("aria-label", visible ? (isEn ? "Show password" : "Şifrəni göstər") : (isEn ? "Hide password" : "Şifrəni gizlət"));
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
  button.innerHTML = pending ? `<span class="auth-spinner" aria-hidden="true"></span>${t("common.loading")}` : label;
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

function guestAccessButton(label = null) {
  const currentLabel = label || (getLanguage() === "en" ? "Continue as guest" : "Hesabsız davam et");
  const wrap = document.createElement("div");
  wrap.className = "auth-guest-wrap";
  const guest = document.createElement("button");
  guest.type = "button";
  guest.className = "auth-guest-link";
  guest.innerHTML = `
    <span>${escapeHtml(currentLabel)}</span>
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  `;
  guest.addEventListener("click", enterGuestWorkspace);
  wrap.appendChild(guest);
  return wrap;
}

async function completeAuthentication(user) {
  if (user?.settings?.language) {
    setLanguage(user.settings.language, true);
  }
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
    console.error("Google login error:", error);
    const form = authRoot.querySelector(".auth-form");
    if (form) setFormError(form, error.message);
  }
}

function googleButtonOptions() {
  return {
    type: "standard",
    theme: document.documentElement.dataset.theme === "dark" ? "filled_black" : "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    width: 380,
  };
}

window.addEventListener("marketify:theme-change", () => {
  const target = document.querySelector(".google-auth-button");
  if (target && window.google?.accounts?.id) {
    try { window.google.accounts.id.renderButton(target, googleButtonOptions()); } catch {}
  }
});

function googleSignInButton() {
  const wrapper = document.createElement("div");
  wrapper.className = "google-auth-wrapper";

  const target = document.createElement("div");
  target.className = "google-auth-button";

  wrapper.appendChild(target);

  const renderGoogleButton = async () => {
    if (!wrapper.isConnected) return;
    if (!window.google?.accounts?.id) {
      setTimeout(renderGoogleButton, 100);
      return;
    }

    if (!runtimeGoogleClientId) {
      await loadAuthConfig();
    }

    if (!runtimeGoogleClientId) return;

    try {
      google.accounts.id.initialize({
        client_id: runtimeGoogleClientId,
        callback: handleGoogleCredential,
        ux_mode: "popup",
      });

      google.accounts.id.renderButton(target, googleButtonOptions());
    } catch (err) {
      console.warn("Google Sign-In button render error:", err);
    }
  };

  requestAnimationFrame(renderGoogleButton);

  return wrapper;
}

function renderLogin() {
  document.title = `${t("auth.login.title")} — Marketify`;

  const content = shell(
    t("auth.login.title"),
    t("auth.login.subtitle")
  );

  const { form, submit } = formBase(t("auth.login.submitBtn"));

  const isEn = getLanguage() === "en";
  form.append(
    field({
      label: t("auth.login.identifierLabel"),
      name: "identifier",
      autocomplete: "username",
      placeholder: isEn ? "name@company.com or username" : "ad@sirket.az və ya username",
    }),
    field({
      label: t("auth.login.passwordLabel"),
      name: "password",
      type: "password",
      autocomplete: "current-password",
      placeholder: isEn ? "Your password" : "Şifrən",
    }),
  );

  const helpers = document.createElement("div");
  helpers.className = "auth-form-helpers";
  helpers.append(
    document.createElement("span"),
    linkButton(t("auth.login.forgotPasswordLink"), "/forgot-password"),
  );

  form.append(helpers, submit);

  const divider = document.createElement("div");
  divider.className = "auth-divider";
  divider.innerHTML = `<span>${isEn ? "or" : "və ya"}</span>`;

  form.append(
    divider,
    googleSignInButton(),
  );

  const switcher = document.createElement("p");
  switcher.className = "auth-switch";
  switcher.append(
    `${t("auth.login.noAccountPrompt")} `,
    linkButton(t("auth.login.signupLink"), "/signup"),
  );

  form.append(
    switcher,
    guestAccessButton(),
    legalNoticeElement(),
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    setFormError(form, "");
    submitState(submit, true, t("auth.login.submitBtn"));

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
      submitState(submit, false, t("auth.login.submitBtn"));
    }
  });

  content.appendChild(form);

  setTimeout(() => form.identifier.focus(), 0);
}

function renderSignup() {
  document.title = `${t("auth.signup.title")} — Marketify`;
  const isEn = getLanguage() === "en";
  const content = shell(t("auth.signup.title"), t("auth.signup.subtitle"));
  const { form, submit } = formBase(t("auth.signup.submitBtn"));
  const fullName = field({ label: t("auth.signup.fullNameLabel"), name: "fullName", autocomplete: "name", placeholder: isEn ? "Full Name" : "Ad və Soyad" });
  const username = field({ label: t("auth.signup.usernameLabel"), name: "username", autocomplete: "username", placeholder: isEn ? "marketer" : "marketoloq" });
  username.classList.add("auth-username-field");
  const usernamePrefix = document.createElement("span");
  usernamePrefix.className = "auth-username-prefix";
  usernamePrefix.textContent = "@";
  username.querySelector(".auth-input-wrap").prepend(usernamePrefix);
  const email = field({ label: t("auth.signup.emailLabel"), name: "email", type: "email", autocomplete: "email", placeholder: isEn ? "name@company.com" : "ad@sirket.az" });
  const password = field({ label: t("auth.signup.passwordLabel"), name: "password", type: "password", autocomplete: "new-password", placeholder: isEn ? "At least 10 characters" : "Ən azı 10 simvol" });
  form.append(fullName, username, email, password, submit);

  const divider = document.createElement("div");
  divider.className = "auth-divider";
  divider.innerHTML = `<span>${isEn ? "or" : "və ya"}</span>`;

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
    availability.textContent = isEn ? "Checking…" : "Yoxlanılır…";
    timer = setTimeout(async () => {
      try {
        const data = await request(`/api/auth/username-availability?username=${encodeURIComponent(clean)}`);
        if (!data.valid) {
          availability.textContent = data.error || (isEn ? "3–30 chars · letters, numbers, dot, underscore" : "3–30 simvol · hərf, rəqəm, nöqtə və alt xətt");
          availability.className = "auth-field-hint is-invalid";
          isUsernameAvailable = false;
        } else if (data.available) {
          availability.textContent = isEn ? `@${clean.toLowerCase()} is available` : `@${clean.toLowerCase()} istifadəyə uyğundur`;
          availability.className = "auth-field-hint is-valid";
          isUsernameAvailable = true;
        } else {
          availability.textContent = isEn ? "This username is already taken" : "Bu istifadəçi adı artıq götürülüb";
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
  switcher.append(`${t("auth.signup.hasAccountPrompt")} `, linkButton(t("auth.signup.loginLink"), "/login"));

  form.append(switcher, guestAccessButton(), legalNoticeElement());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isUsernameAvailable === false) {
      setFormError(form, isEn ? "This username is already taken. Please choose another." : "Bu istifadəçi adı artıq götürülüb. Başqa ad seç.", "username");
      return;
    }
    setFormError(form, "");
    submitState(submit, true, t("auth.signup.submitBtn"));
    
    try {
      const formData = Object.fromEntries(new FormData(form));
      formData.username = String(formData.username || "").trim().replace(/^@+/, "");
      formData.language = getLanguage();
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
      throw new Error(isEn ? "Could not initiate verification process." : "Təsdiq prosesini başlatmaq mümkün olmadı.");
    } catch (error) {
      setFormError(form, error.message, error.field);
      submitState(submit, false, t("auth.signup.submitBtn"));
    }
  });
  content.appendChild(form);
  setTimeout(() => form.fullName.focus(), 0);
}

function renderEmailVerification() {
  document.title = `${t("auth.verifyEmail.title")} — Marketify`;
  const isEn = getLanguage() === "en";
  const email = new URLSearchParams(location.search).get("email") || "";
  const deliveryPending = new URLSearchParams(location.search).get("delivery") === "pending";
  const requestedCooldown = Number(new URLSearchParams(location.search).get("cooldown"));
  const content = shell(t("auth.verifyEmail.title"), t("auth.verifyEmail.subtitle", { email: email || (isEn ? "your email" : "e-poçtunuza") }));
  const { form, submit } = formBase(t("auth.verifyEmail.submitBtn"));
  const emailField = field({ label: t("auth.signup.emailLabel"), name: "email", type: "email", autocomplete: "email", placeholder: isEn ? "name@company.com" : "ad@sirket.az" });
  emailField.querySelector("input").value = email;
  const codeField = field({ label: t("auth.verifyEmail.codeLabel"), name: "code", autocomplete: "one-time-code", placeholder: "123456", hint: isEn ? "Code is valid for 10 minutes." : "Kod 10 dəqiqə ərzində etibarlıdır." });
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
      const resendText = t("auth.verifyEmail.resendBtn");
      resend.textContent = remaining > 0 ? `${resendText} · ${minutes}:${String(secondsPart).padStart(2, "0")}` : resendText;
      resendHint.textContent = remaining > 0 ? (isEn ? "Please wait before requesting a new code" : "Yeni kod üçün qısa gözləmə") : (isEn ? "Didn't receive the code? Resend." : "Kod gəlməyibsə, yenidən göndər.");
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
      resendHint.textContent = data.message || t("auth.verifyEmail.resendSuccess");
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
  switcher.append(resendWrap, linkButton(isEn ? "Back to sign in" : "Daxil olmağa qayıt", "/login"));
  form.append(switcher);
  if (deliveryPending) {
    setFormError(form, isEn ? "Account created, but verification email could not be sent. Please click Resend Code." : "Hesab yaradıldı, amma kod göndərilmədi. Aşağıdakı düymə ilə yenidən göndər.");
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormError(form, "");
    if (!/^\d{6}$/.test(form.code.value.trim())) return setFormError(form, isEn ? "Enter the 6-digit verification code." : "6 rəqəmli təsdiq kodunu daxil et.", "code");
    submitState(submit, true, t("auth.verifyEmail.submitting"));
    try {
      const data = await request("/api/auth/email-verification/confirm", {
        method: "POST",
        body: JSON.stringify({ email: form.email.value, code: form.code.value.trim() }),
      });
      await completeAuthentication(data.user);
    } catch (error) {
      setFormError(form, error.message, error.code === "INVALID_EMAIL_VERIFICATION_CODE" ? "code" : "email");
      submitState(submit, false, t("auth.verifyEmail.submitBtn"));
    }
  });
  content.appendChild(form);
  setTimeout(() => (email ? codeInput : form.email).focus(), 0);
}

function renderForgot() {
  document.title = `${t("auth.forgotPassword.title")} — Marketify`;
  const isEn = getLanguage() === "en";
  const content = shell(t("auth.forgotPassword.title"), t("auth.forgotPassword.subtitle"));
  const { form, submit } = formBase(t("auth.forgotPassword.submitBtn"));
  form.append(field({ label: t("auth.forgotPassword.emailLabel"), name: "email", type: "email", autocomplete: "email", placeholder: isEn ? "name@company.com" : "ad@sirket.az" }), submit);
  const back = document.createElement("p");
  back.className = "auth-switch";
  back.append(linkButton(isEn ? "← Back to sign in" : "← Daxil olmağa qayıt", "/login"));
  form.append(back);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitState(submit, true, t("auth.forgotPassword.submitting"));
    try {
      const data = await request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: form.email.value }) });
      form.replaceChildren();
      const done = document.createElement("div");
      done.className = "auth-success";
      done.innerHTML = `<span>✓</span><h3>${isEn ? "Check your email" : "E-poçtunu yoxla"}</h3><p>${data.message || t("auth.forgotPassword.sentNotice")}</p>`;
      done.appendChild(linkButton(isEn ? "Back to sign in" : "Daxil olmağa qayıt", "/login"));
      form.appendChild(done);
    } catch (error) {
      setFormError(form, error.message);
      submitState(submit, false, t("auth.forgotPassword.submitBtn"));
    }
  });
  content.appendChild(form);
}

function renderReset() {
  document.title = `${t("auth.resetPassword.title")} — Marketify`;
  const isEn = getLanguage() === "en";
  const content = shell(t("auth.resetPassword.title"), t("auth.resetPassword.subtitle"));
  const token = new URLSearchParams(location.search).get("token") || "";
  const { form, submit } = formBase(t("auth.resetPassword.submitBtn"));
  form.append(
    field({ label: t("auth.resetPassword.newPasswordLabel"), name: "password", type: "password", autocomplete: "new-password", placeholder: isEn ? "At least 10 characters" : "Ən azı 10 simvol", hint: isEn ? "At least 10 characters with letters and numbers" : "Ən azı 10 simvol, bir hərf və bir rəqəm" }),
    field({ label: t("auth.resetPassword.confirmPasswordLabel"), name: "confirmPassword", type: "password", autocomplete: "new-password", placeholder: isEn ? "Re-enter new password" : "Yeni şifrəni təkrar yaz" }),
    submit,
  );
  const newLink = document.createElement("p");
  newLink.className = "auth-switch";
  newLink.append(linkButton(isEn ? "Request new reset link" : "Yeni bərpa keçidi istə", "/forgot-password"));
  form.appendChild(newLink);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormError(form, "");
    if (form.password.value !== form.confirmPassword.value) {
      return setFormError(form, isEn ? "Passwords do not match." : "Yeni şifrələr eyni deyil.", "confirmPassword");
    }
    submitState(submit, true, t("auth.resetPassword.submitting"));
    try {
      await request("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password: form.password.value }) });
      form.replaceChildren();
      const done = document.createElement("div");
      done.className = "auth-success";
      done.innerHTML = `<span>✓</span><h3>${isEn ? "Password Updated" : "Şifrə yeniləndi"}</h3><p>${t("auth.resetPassword.successNotice")}</p>`;
      done.appendChild(linkButton(t("auth.login.title"), "/login"));
      form.appendChild(done);
    } catch (error) {
      setFormError(form, error.message);
      submitState(submit, false, t("auth.resetPassword.submitBtn"));
    }
  });
  content.appendChild(form);
}

function renderOnboarding(user) {
  const isEn = getLanguage() === "en";
  document.title = `${isEn ? "Set up Marketify" : "Marketify-ni hazırla"} — Marketify`;
  document.body.classList.add("auth-active");
  const firstName = user.fullName.split(" ")[0];
  const content = shell(
    isEn ? `Welcome, ${firstName}` : `Salam, ${firstName}`,
    isEn ? "Choose your primary focus to tailor Marketify to your workflow." : "Marketify-ni işinə uyğunlaşdırmaq üçün əsas fokusunu seç."
  );
  const form = document.createElement("form");
  form.className = "onboarding-form";
  form.innerHTML = `<div class="auth-error" role="alert" hidden></div><div class="onboarding-options">
    <label><input type="radio" name="focus" value="business" checked><span><strong>${isEn ? "Business Strategy" : "Biznes strategiyası"}</strong><small>${isEn ? "Positioning, growth, and execution plan" : "Mövqelənmə, böyümə və icra planı"}</small></span></label>
    <label><input type="radio" name="focus" value="campaign"><span><strong>${isEn ? "Campaigns" : "Kampaniya"}</strong><small>${isEn ? "Launch and marketing campaigns" : "Launch və marketinq kampaniyaları"}</small></span></label>
    <label><input type="radio" name="focus" value="brand"><span><strong>${isEn ? "Brand Strategy" : "Brend"}</strong><small>${isEn ? "Audience, messaging, and brand direction" : "Auditoriya, mesaj və brend istiqaməti"}</small></span></label>
    <label><input type="radio" name="focus" value="research"><span><strong>${isEn ? "Research" : "Araşdırma"}</strong><small>${isEn ? "Market, competitors, and decision support" : "Bazar, rəqib və qərar dəstəyi"}</small></span></label>
  </div>`;
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "auth-submit";
  submit.textContent = isEn ? "Continue to Workspace" : "Workspace-ə keç";
  form.appendChild(submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitState(submit, true, isEn ? "Continuing…" : "Keçid edilir…");
    try {
      const data = await request("/api/auth/onboarding", { method: "POST", body: JSON.stringify({ focus: form.focus.value }) });
      await completeAuthentication(data.user);
    } catch (error) {
      setFormError(form, error.message);
      submitState(submit, false, isEn ? "Continue to Workspace" : "Workspace-ə keç");
    }
  });
  content.appendChild(form);
}

function renderRoute() {
  const path = location.pathname;
  if (!AUTH_PATHS.has(path)) {
    if (appShell.hidden) {
      appShell.hidden = false;
      authRoot.hidden = true;
      document.body.classList.remove("auth-loading");
      document.body.classList.remove("auth-active");
    }
    return;
  }
  appShell.hidden = true;
  authRoot.hidden = false;
  document.body.classList.remove("auth-loading");
  document.body.classList.add("auth-active");
  if (path === "/signup") return renderSignup();
  if (path === "/forgot-password") return renderForgot();
  if (path === "/reset-password") return renderReset();
  if (path === "/verify-email") return renderEmailVerification();
  if (path !== "/login") route("/login", true);
  return renderLogin();
}

export async function initializeAuthentication(onAuthenticated) {
  authenticatedCallback = onAuthenticated;
  loadAuthConfig().catch(() => {});
  const requestedReturn = new URLSearchParams(location.search).get("returnTo");
  pendingReturnPath = requestedReturn
    ? safeInternalPath(requestedReturn === "/" ? "/workspace" : requestedReturn)
    : AUTH_PATHS.has(location.pathname)
      ? "/workspace"
      : safeInternalPath(`${location.pathname}${location.search}${location.hash}`);
  window.addEventListener("popstate", renderRoute);
  window.addEventListener("marketify:auth-required", () => {
    pendingReturnPath = safeInternalPath(`${location.pathname}${location.search}${location.hash}`);
    route(`/login?returnTo=${encodeURIComponent(pendingReturnPath)}`, true);
    renderRoute();
  });
  window.addEventListener("marketify:language-change", () => {
    if (AUTH_PATHS.has(location.pathname)) {
      renderRoute();
    }
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
