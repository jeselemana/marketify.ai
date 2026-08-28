/* Loaded synchronously in <head>: Light is enforced for all users. Theme configuration is preserved for future reactivation. */
(() => {
  const storageKey = document.currentScript?.dataset.storageKey || "marketify_theme";
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const lightThemeColor = themeColor?.content || "#f8f9fb";
  // Restrict user theme switching: always enforce light mode.
  const normalize = (_value) => "light";

  function syncControls() {
    // Theme toggle controls removed from interface.
  }

  function applyTheme(value, persist = false) {
    const theme = normalize(value);
    root.dataset.theme = theme;
    if (themeColor) themeColor.content = lightThemeColor;
    if (persist) {
      try { localStorage.setItem(storageKey, theme); } catch {}
    }
    syncControls();
    window.dispatchEvent(new CustomEvent("marketify:theme-change", { detail: { theme } }));
  }

  applyTheme("light");

  document.addEventListener("click", (event) => {
    const control = event.target.closest?.("[data-theme-toggle], [data-theme-choice]");
    if (!control || control.disabled) return;
    applyTheme("light", true);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) applyTheme("light");
  });
})();
