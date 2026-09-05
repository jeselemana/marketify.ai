/* Loaded synchronously in <head>: FOUC-free Theme State Engine with Slate Dark Mode */
(() => {
  const storageKey = document.currentScript?.dataset.storageKey || "helmer_theme";
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const lightThemeColor = themeColor?.content || "#f8f9fb";
  const darkThemeColor = "#000000";

  function getSystemPreference() {
    try {
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    } catch {}
    return "light";
  }

  function resolveStoredTheme() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "dark" || stored === "light") return stored;
    } catch {}
    return null;
  }

  const normalize = (value) => {
    if (value === "dark") return "dark";
    if (value === "light") return "light";
    const stored = resolveStoredTheme();
    if (stored) return stored;
    return getSystemPreference();
  };

  // Immediate FOUC prevention before stylesheets evaluate
  const initialTheme = normalize();
  if (initialTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.dataset.theme = initialTheme;
  if (themeColor) themeColor.content = initialTheme === "dark" ? darkThemeColor : lightThemeColor;

  function syncControls() {
    const isDark = root.dataset.theme === "dark";
    let isEn = false;
    try {
      isEn = localStorage.getItem("helmer_language") === "en" || localStorage.getItem("marketify_language") === "en" || root.lang === "en";
    } catch {}
    const label = isEn
      ? (isDark ? "Switch to Light Mode" : "Switch to Dark Mode")
      : (isDark ? "Light Mode-a keç" : "Dark Mode-a keç");

    document.querySelectorAll("[data-theme-toggle]").forEach((control) => {
      control.setAttribute("aria-label", label);
      control.setAttribute("aria-pressed", String(isDark));
      control.setAttribute("title", label);
      if (control.hasAttribute("data-tooltip")) control.dataset.tooltip = label;
    });

    document.querySelectorAll("[data-theme-choice]").forEach((control) => {
      const active = control.dataset.themeChoice === root.dataset.theme;
      control.setAttribute("aria-pressed", String(active));
      if (active) control.classList.add("is-active");
      else control.classList.remove("is-active");
    });
  }

  function applyTheme(value, persist = false) {
    const theme = value === "dark" || value === "light" ? value : normalize(value);
    root.dataset.theme = theme;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (themeColor) themeColor.content = theme === "dark" ? darkThemeColor : lightThemeColor;
    if (persist) {
      try {
        localStorage.setItem(storageKey, theme);
      } catch {}
    }
    syncControls();
    window.dispatchEvent(new CustomEvent("helmer:theme-change", { detail: { theme } }));
  }

  // Click handler for theme toggles and choice buttons
  document.addEventListener("click", (event) => {
    const control = event.target.closest?.("[data-theme-toggle], [data-theme-choice]");
    if (!control || control.disabled) return;
    const targetTheme = control.dataset.themeChoice || (root.dataset.theme === "dark" ? "light" : "dark");
    applyTheme(targetTheme, true);
  });

  // Cross-tab synchronization
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) {
      if (event.newValue === "dark" || event.newValue === "light") {
        applyTheme(event.newValue, false);
      } else if (event.newValue === null) {
        applyTheme(getSystemPreference(), false);
      }
    }
    if (event.key === "helmer_language" || event.key === "marketify_language") {
      syncControls();
    }
  });

  // Listen to system preference changes if user hasn't explicitly set preference
  try {
    if (typeof window !== "undefined" && window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener?.("change", (e) => {
        if (!resolveStoredTheme()) {
          applyTheme(e.matches ? "dark" : "light", false);
        }
      });
    }
  } catch {}

  window.addEventListener("helmer:language-change", () => syncControls());

  // Observe dynamically rendered controls
  const observeControls = () => {
    syncControls();
    if (typeof MutationObserver !== "undefined" && document.body) {
      new MutationObserver((records) => {
        if (records.some((record) => Array.from(record.addedNodes || []).some((node) =>
          node.nodeType === 1 && (node.matches?.("[data-theme-toggle], [data-theme-choice]") ||
            node.querySelector?.("[data-theme-toggle], [data-theme-choice]"))))) {
          syncControls();
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeControls, { once: true });
  } else {
    observeControls();
  }
})();
