/* home.js — Public homepage interactions (mobile menu, composers, tabs, copyright year). */

/* ── Mobile menu toggle ───────────────────────────────────────────── */
const menuToggle = document.querySelector(".menu-toggle");
const mobileNav = document.getElementById("mobileNav");

if (menuToggle && mobileNav) {
  menuToggle.hidden = false; // show the button on mobile (CSS hides it on desktop anyway)

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    mobileNav.hidden = isOpen;

    // Swap icon between ☰ and ✕
    menuToggle.innerHTML = isOpen
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  });

  // Close mobile nav when a link inside is clicked
  mobileNav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      menuToggle.setAttribute("aria-expanded", "false");
      mobileNav.hidden = true;
      menuToggle.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>';
    }
  });
}

/* ── Composer logic (hero + final section) ────────────────────────── */
document.querySelectorAll(".home-composer").forEach((form) => {
  const textarea = form.querySelector("textarea");
  const submit = form.querySelector(".composer-submit");
  const modeInputs = form.querySelectorAll('input[name="mode"]');
  const modeDesc = form.closest(".composer-wrap")?.querySelector(".mode-description");
  const status = form.closest(".composer-wrap")?.querySelector(".composer-status");

  const MODE_LABELS = { ask: "Araşdır və düşün", build: "Yarat və icra et" };

  // Enable/disable submit
  if (textarea && submit) {
    textarea.addEventListener("input", () => {
      submit.disabled = !textarea.value.trim();
    });
  }

  // Mode label switch
  modeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (modeDesc) modeDesc.textContent = MODE_LABELS[input.value] || "";
    });
  });

  // Submit → redirect to workspace
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const prompt = textarea?.value.trim();
    if (!prompt) return;
    const mode = form.querySelector('input[name="mode"]:checked')?.value || "ask";
    const params = new URLSearchParams({ mode, prompt });
    window.location.href = `/workspace?${params}`;
  });

  // Enter to submit (shift+enter for new line)
  if (textarea) {
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (textarea.value.trim()) form.requestSubmit();
      }
    });
  }
});

/* ── Product preview tabs ─────────────────────────────────────────── */
const previewTabs = document.querySelectorAll(".preview-tabs button");
const previewPanels = document.querySelectorAll(".product-preview");

if (previewTabs.length && previewPanels.length) {
  previewTabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
      previewTabs.forEach((t) => t.setAttribute("aria-selected", "false"));
      tab.setAttribute("aria-selected", "true");
      previewPanels.forEach((p, j) => (p.hidden = j !== i));
    });
  });
}

/* ── Copyright year ───────────────────────────────────────────────── */
const yearEl = document.getElementById("copyrightYear");
if (yearEl) yearEl.textContent = new Date().getFullYear();
