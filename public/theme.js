/* Loaded synchronously in <head>: Light is the default, never the OS preference. */
(() => {
  const storageKey = document.currentScript?.dataset.storageKey || "marketify_theme";
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const lightThemeColor = themeColor?.content || "#f8f9fb";
  const normalize = (value) => value === "dark" ? "dark" : "light";

  function syncControls() {
    const dark = root.dataset.theme === "dark";
    let isEn = false;
    try {
      isEn = localStorage.getItem("marketify_language") === "en" || root.lang === "en";
    } catch {}
    const label = isEn
      ? (dark ? "Switch to Light Mode" : "Switch to Dark Mode")
      : (dark ? "Light Mode-a keç" : "Dark Mode-a keç");
    document.querySelectorAll("[data-theme-toggle]").forEach((control) => {
      control.setAttribute("aria-label", label);
      control.setAttribute("aria-pressed", String(dark));
      control.setAttribute("title", label);
      if (control.hasAttribute("data-tooltip")) control.dataset.tooltip = label;
    });
    document.querySelectorAll("[data-theme-choice]").forEach((control) => {
      control.setAttribute("aria-pressed", String(control.dataset.themeChoice === root.dataset.theme));
    });
  }

  function applyTheme(value, persist = false) {
    const theme = normalize(value);
    root.dataset.theme = theme;
    if (themeColor) themeColor.content = theme === "dark" ? "#111213" : lightThemeColor;
    if (persist) {
      // A blocked/quota-limited storage API must not break the switch or the app.
      try { localStorage.setItem(storageKey, theme); } catch {}
    }
    syncControls();
    window.dispatchEvent(new CustomEvent("marketify:theme-change", { detail: { theme } }));
  }

  let savedTheme;
  try { savedTheme = localStorage.getItem(storageKey); } catch {}
  applyTheme(savedTheme);

  document.addEventListener("click", (event) => {
    const control = event.target.closest?.("[data-theme-toggle], [data-theme-choice]");
    if (!control || control.disabled) return;
    applyTheme(control.dataset.themeChoice || (root.dataset.theme === "dark" ? "light" : "dark"), true);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) applyTheme(event.newValue);
    if (event.key === "marketify_language") syncControls();
  });
  window.addEventListener("marketify:language-change", () => syncControls());
  // Delegation and observing only inserted controls also cover dynamically rendered settings.
  const observeControls = () => {
    syncControls();
    new MutationObserver((records) => {
      if (records.some((record) => Array.from(record.addedNodes).some((node) =>
        node.nodeType === 1 && (node.matches("[data-theme-toggle], [data-theme-choice]") ||
          node.querySelector("[data-theme-toggle], [data-theme-choice]"))))) syncControls();
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeControls, { once: true });
  else observeControls();
})();
