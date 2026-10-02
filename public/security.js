(function () {
  const revisions = new Map();
  let turnstileToken = null;

  async function reauthenticate() {
    return new Promise((resolve, reject) => {
      const modal = document.createElement("div");
      modal.className = "modal-backdrop active";
      modal.style.zIndex = "99999";
      modal.innerHTML = `
        <div class="modal-card" style="max-width:400px;margin:15vh auto;background:var(--bg-surface, #fff);padding:24px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.2);">
          <h3 style="margin-top:0;">Təsdiq tələb olunur</h3>
          <p style="font-size:14px;color:var(--text-secondary,#666);">Davam etmək üçün cari şifrənizi daxil edin:</p>
          <input type="password" id="helmer-reauth-pw" class="form-input" style="width:100%;margin:12px 0 16px;padding:8px 12px;box-sizing:border-box;" placeholder="Cari şifrə" autofocus />
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button type="button" id="helmer-reauth-cancel" class="secondary-button">İmtina</button>
            <button type="button" id="helmer-reauth-submit" class="primary-button">Təsdiq et</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const input = modal.querySelector("#helmer-reauth-pw");
      const submitBtn = modal.querySelector("#helmer-reauth-submit");
      const cancelBtn = modal.querySelector("#helmer-reauth-cancel");

      function cleanup() {
        modal.remove();
      }

      submitBtn.onclick = () => {
        const pw = input.value;
        if (!pw) return;
        cleanup();
        resolve({ currentPassword: pw });
      };
      input.onkeydown = (e) => {
        if (e.key === "Enter") submitBtn.click();
        if (e.key === "Escape") cancelBtn.click();
      };
      cancelBtn.onclick = () => {
        cleanup();
        reject(new Error("Reauthentication cancelled by user"));
      };
    });
  }

  function randomIdempotencyKey() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  window.helmerSecurity = {
    revisions,
    rememberChat(chat) {
      if (chat?.id) revisions.set(chat.id, chat.revision || 1);
    },
    getRevision(chatId) {
      return revisions.get(chatId) || 1;
    },
    reauthenticate,
    idempotencyKey: randomIdempotencyKey,
    setTurnstileToken(token) {
      turnstileToken = token;
    },
    getTurnstileToken() {
      return turnstileToken;
    },
  };

  const originalFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    const url = typeof input === "string" ? input : input?.url || "";
    const isMutation = ["POST", "PATCH", "PUT"].includes((init.method || "GET").toUpperCase());
    if (isMutation && url.includes("/api/")) {
      const headers = new Headers(init.headers || {});
      if (!headers.has("Idempotency-Key")) {
        headers.set("Idempotency-Key", randomIdempotencyKey());
      }
      if (turnstileToken && !headers.has("X-Helmer-Turnstile-Token")) {
        headers.set("X-Helmer-Turnstile-Token", turnstileToken);
      }
      init.headers = headers;
    }
    return originalFetch.call(this, input, init);
  };
})();
