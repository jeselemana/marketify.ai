const authRoot = document.querySelector("#authRoot");
const appShell = document.querySelector("#appShell");
const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);
let pendingReturnPath = "/";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
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
    <section class="auth-story" aria-label="Marketify haqqında">
      <a class="auth-brand" href="/login"><span>M</span><strong>Marketify</strong></a>
      <div class="auth-story-copy">
        <span class="auth-eyebrow">AI STRATEGY WORKSPACE</span>
        <h1>Məqsəddən aydın strategiyaya.</h1>
        <p>Marketify biznes kontekstini anlayır, vacib detalları dəqiqləşdirir və icra oluna bilən plan qurur.</p>
      </div>
      <p class="auth-story-note">Strategiya qur · təkmilləşdir · yadda saxla</p>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <div class="auth-heading"><span class="auth-mobile-mark">M</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>
        <div class="auth-content"></div>
      </div>
    </section>`;
  authRoot.appendChild(layout);
  return layout.querySelector(".auth-content");
}

function field({ label, name, type = "text", autocomplete, placeholder = "", hint = "" }) {
  const wrapper = document.createElement("label");
  wrapper.className = "auth-field";
  wrapper.innerHTML = `<span>${label}</span><span class="auth-input-wrap"><input name="${name}" type="${type}" autocomplete="${autocomplete || "off"}" placeholder="${placeholder}" required /><button class="password-toggle" type="button" aria-label="Şifrəni göstər" ${type === "password" ? "" : "hidden"}>Göstər</button></span><small>${hint}</small>`;
  const input = wrapper.querySelector("input");
  input.setAttribute("aria-label", label);
  const toggle = wrapper.querySelector(".password-toggle");
  if (type === "password") toggle.addEventListener("click", () => {
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    toggle.textContent = visible ? "Göstər" : "Gizlət";
    toggle.setAttribute("aria-label", visible ? "Şifrəni göstər" : "Şifrəni gizlət");
  });
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
  const guest = document.createElement("button");
  guest.type = "button";
  guest.className = "auth-guest-button";
  guest.innerHTML = `<strong>${escapeHtml(label)}</strong><span>Strategiyalar bu cihazda saxlanacaq</span>`;
  guest.addEventListener("click", enterGuestWorkspace);
  return guest;
}

async function completeAuthentication(user) {
  if (!user.onboardingCompleted) return renderOnboarding(user);
  authRoot.hidden = true;
  appShell.hidden = false;
  document.body.classList.remove("auth-loading", "auth-active");
  route(pendingReturnPath, true);
  await authenticatedCallback?.(user);
}

function renderLogin() {
  document.title = "Daxil ol — Marketify";
  const content = shell("Yenidən xoş gəldin", "Strategiyalarına və Marketify workspace-inə davam et.");
  const { form, submit } = formBase("Daxil ol");
  form.append(
    field({ label: "E-poçt və ya istifadəçi adı", name: "identifier", autocomplete: "username", placeholder: "ad@şirkət.az və ya username" }),
    field({ label: "Şifrə", name: "password", type: "password", autocomplete: "current-password", placeholder: "Şifrən" }),
  );
  const helpers = document.createElement("div");
  helpers.className = "auth-form-helpers";
  helpers.append(document.createElement("span"), linkButton("Şifrəni unutmusansa", "/forgot-password"));
  form.append(helpers, submit);
  const switcher = document.createElement("p");
  switcher.className = "auth-switch";
  switcher.append("Hesabın yoxdur? ", linkButton("Pulsuz hesab yarat", "/signup"));
  form.append(switcher, guestAccessButton());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormError(form, "");
    submitState(submit, true, "Daxil ol");
    try {
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: form.identifier.value, password: form.password.value }),
      });
      await completeAuthentication(data.user);
    } catch (error) {
      setFormError(form, error.message);
      submitState(submit, false, "Daxil ol");
    }
  });
  content.appendChild(form);
  setTimeout(() => form.identifier.focus(), 0);
}

function renderSignup() {
  document.title = "Hesab yarat — Marketify";
  const content = shell("Marketify hesabını yarat", "Strategiyalarını təhlükəsiz saxla və istənilən cihazdan davam et.");
  const { form, submit } = formBase("Hesab yarat");
  const fullName = field({ label: "Ad və soyad", name: "fullName", autocomplete: "name", placeholder: "Ad Soyad" });
  const username = field({ label: "İstifadəçi adı", name: "username", autocomplete: "username", placeholder: "marketinq.lideri", hint: "3–30 simvol · hərf, rəqəm, nöqtə və alt xətt" });
  username.classList.add("auth-username-field");
  const usernamePrefix = document.createElement("span");
  usernamePrefix.className = "auth-username-prefix";
  usernamePrefix.textContent = "@";
  username.querySelector(".auth-input-wrap").prepend(usernamePrefix);
  const email = field({ label: "E-poçt", name: "email", type: "email", autocomplete: "email", placeholder: "ad@şirkət.az" });
  const password = field({ label: "Şifrə", name: "password", type: "password", autocomplete: "new-password", placeholder: "Ən azı 10 simvol", hint: "Ən azı 10 simvol, bir hərf və bir rəqəm" });
  form.append(fullName, username, email, password, submit);
  const availability = username.querySelector("small");
  let timer;
  form.username.addEventListener("input", () => {
    clearTimeout(timer);
    availability.className = "";
    availability.textContent = "Yoxlanılır…";
    timer = setTimeout(async () => {
      try {
        const data = await request(`/api/auth/username-availability?username=${encodeURIComponent(form.username.value)}`);
        availability.textContent = data.valid ? (data.available ? `@${form.username.value.trim().toLowerCase()} mövcuddur` : "Bu istifadəçi adı artıq götürülüb") : "3–30 simvol · hərf, rəqəm, nöqtə və alt xətt";
        availability.className = data.valid && data.available ? "is-valid" : data.valid ? "is-invalid" : "";
      } catch { availability.textContent = "Mövcudluğu indi yoxlamaq mümkün olmadı."; }
    }, 400);
  });
  const terms = document.createElement("p");
  terms.className = "auth-terms";
  terms.textContent = "Davam etməklə Marketify hesabının təhlükəsizlik qaydalarını qəbul edirsən.";
  const switcher = document.createElement("p");
  switcher.className = "auth-switch";
  switcher.append("Artıq hesabın var? ", linkButton("Daxil ol", "/login"));
  form.append(terms, switcher, guestAccessButton("İndi hesab yaratmadan davam et"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormError(form, "");
    submitState(submit, true, "Hesab yarat");
    try {
      const data = await request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      await completeAuthentication(data.user);
    } catch (error) {
      setFormError(form, error.message, error.field);
      submitState(submit, false, "Hesab yarat");
    }
  });
  content.appendChild(form);
  setTimeout(() => form.fullName.focus(), 0);
}

function renderForgot() {
  document.title = "Şifrəni yenilə — Marketify";
  const content = shell("Şifrəni unutmusansa", "E-poçtunu yaz. Hesab mövcuddursa, təhlükəsiz yeniləmə keçidi göndərəcəyik.");
  const { form, submit } = formBase("Keçid göndər");
  form.append(field({ label: "E-poçt", name: "email", type: "email", autocomplete: "email", placeholder: "ad@şirkət.az" }), submit);
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
  const content = shell("Yeni şifrə yarat", "Hesabın üçün güclü və başqa xidmətlərdə istifadə etmədiyin şifrə seç.");
  const token = new URLSearchParams(location.search).get("token") || "";
  const { form, submit } = formBase("Şifrəni yenilə");
  form.append(
    field({ label: "Yeni şifrə", name: "password", type: "password", autocomplete: "new-password", placeholder: "Ən azı 10 simvol", hint: "Ən azı 10 simvol, bir hərf və bir rəqəm" }),
    field({ label: "Yeni şifrəni təsdiqlə", name: "confirmPassword", type: "password", autocomplete: "new-password", placeholder: "Yeni şifrəni təkrar yaz" }),
    submit,
  );
  const newLink = document.createElement("p");
  newLink.className = "auth-switch";
  newLink.append(linkButton("Yeni yeniləmə keçidi istə", "/forgot-password"));
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
