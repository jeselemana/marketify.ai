// Elementlər
const modelBtn = document.getElementById("model-btn");
const dropdownMenu = document.getElementById("dropdownMenu");
const arrow = document.querySelector(".arrow-down");
const clearBtn = document.getElementById("clearChat");
const chatBox = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const center = document.getElementById("center-view");
const promptContainer = document.querySelector(".prompt-bubbles");
const sendBtn = document.getElementById("send-btn");
const brandTitle = document.querySelector(".brand-sub");
const taglineEl = document.querySelector(".tagline");
const newTitle = document.querySelector(".new-dynamic-title");
const newDisclaimer = document.querySelector(".new-chat-disclaimer");
const confirmPopup = document.getElementById("confirmPopup");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");

const promptSuggestions = [
  { title: "Growth Hacking", sub: "strategiyasını düzgün tətbiq etmə yolları" },
  { title: "Black Friday-də", sub: "sərfəli təkliflərlə yanaşı mənfəət artırmaq" },
  { title: "Alış-veriş həvəskarları üçün", sub: "cəlbedici təkliflər" },
  { title: "Minimum büdcə", sub: "ilə maksimum gəlir əldə etmə üsulları" },
  { title: "Yeni il kampaniyası", sub: "üçün kreativ strategiya" },
  { title: "Satışları artırmaq", sub: "üçün 5 psixoloji üsul" },
  { title: "Brend hekayəsi", sub: "yazmaqda kömək et" },
  { title: "Email marketinq", sub: "üçün başlıq ideyaları" },
  { title: "Müştəri rəyləri", sub: "üçün cavab şablonu" },
  { title: "Landing page", sub: "üçün dönüşüm artıran variant" },
  { title: "Reklam büdcəsi", sub: "üçün aylıq plan hazırlamağa kömək et" },
  { title: "SMM strategiyası", sub: "3 aylıq mini plan ver" },
  { title: "Biznes audit", sub: "qısa təhlil et" },
  { title: "Instagram Reels", sub: "üçün viral ssenari" },
  { title: "TikTok trendləri", sub: "biznesimə necə uyğunlaşdırım?" },
  { title: "LinkedIn postu", sub: "peşəkar üslubda yaz" },
  { title: "YouTube videosu", sub: "üçün SEO təsviri" },
  { title: "Caption ideyası", sub: "qısa və kreativ olsun" },
  { title: "Trend audiosu", sub: "bu sahəyə uyğun tap" },
  { title: "Reklam sloqanı", sub: "qısa və yaddaqalan olsun" },
  { title: "Logo dizaynı", sub: "üçün prompt hazırla" },
  { title: "Məhsul adı", sub: "tapmaqda kömək et" },
  { title: "Startap ideyası", sub: "üçün SWOT analizi" },
  { title: "Brand voice", sub: "təklif et" },
  { title: "Yerli auditoriyanı", sub: "cəlb edəcək reklam kampaniyası" },
  { title: "Azərbaycanda SMM", sub: "üçün düzgün ton" },
  { title: "Endirim aksiyası", sub: "Azərbaycan bazarına uyğun yaz" },
  { title: "AI ilə kontent", sub: "yaratma planı hazırla" },
  { title: "Prompt optimallaşdırma", sub: "üçün ipucları ver" },
  { title: "SEO açar sözlər", sub: "bu mövzu üçün tap" },
  { title: "Blog yazısı", sub: "giriş hissəsi yaz" },
  { title: "Müsahibə sualları", sub: "SMM meneceri üçün" },
  { title: "Press-reliz", sub: "üçün professional mətn yaz" },
  { title: "Böhran vəziyyətində", sub: "bilməli olduqlarım" }
];

function hideCenterElements() {
  if (brandTitle) brandTitle.style.display = "none";
  if (taglineEl) taglineEl.style.display = "none";
  if (promptContainer) promptContainer.style.display = "none";
}

function showCenterElements() {
  if (brandTitle) brandTitle.style.display = "block";
  if (taglineEl) taglineEl.style.display = "block";
  if (promptContainer) {
    promptContainer.style.display = "flex";
    loadDynamicBubbles();
  }
}

function showNewChat() {
  if (newTitle) newTitle.classList.add("show");
  if (newDisclaimer) newDisclaimer.classList.add("show");
  if (brandTitle) brandTitle.style.opacity = "0";
  if (taglineEl) taglineEl.style.opacity = "0";
}

function hideNewChat() {
  if (newTitle) newTitle.classList.remove("show");
  if (newDisclaimer) newDisclaimer.classList.remove("show");
}

function loadDynamicBubbles() {
  if (!promptContainer) return;

  promptContainer.innerHTML = "";
  const selected = promptSuggestions
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  selected.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = "bubble";
    btn.innerHTML = `
      <div class="bubble-content">
        <span class="bubble-title">${item.title}</span>
        <span class="bubble-sub">${item.sub}</span>
      </div>
    `;

    btn.addEventListener("click", () => {
      if (!input) return;
      input.value = `${item.title} ${item.sub}`;
      input.focus();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      hideCenterElements();
      showNewChat();
    });

    promptContainer.appendChild(btn);
  });
}

// Model seçimi
let selectedModel = "gpt-4o";

if (modelBtn) {
  modelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownMenu?.classList.toggle("show");
    arrow?.classList.toggle("open");
  });
}

document.addEventListener("click", (e) => {
  if (
    dropdownMenu &&
    !dropdownMenu.contains(e.target) &&
    modelBtn &&
    !modelBtn.contains(e.target)
  ) {
    dropdownMenu.classList.remove("show");
    arrow?.classList.remove("open");
  }
});

document.querySelectorAll(".model-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();

    document
      .querySelectorAll(".model-item")
      .forEach((m) => m.classList.remove("selected"));

    item.classList.add("selected");
    selectedModel = item.dataset.model;

    const brand = document.querySelector(".brand");
    const version = document.querySelector(".version");

    if (selectedModel === "local") {
      if (brand) brand.textContent = "Marketify Brain";
      if (version) version.textContent = "Beta";
    } else {
      if (brand) brand.textContent = "Marketify AI";
      if (version) version.textContent = "2.0";
    }

    dropdownMenu?.classList.remove("show");
    arrow?.classList.remove("open");
  });
});

function addMessage(role, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", role);
  msg.innerHTML = text;
  chatBox?.appendChild(msg);
  scrollToBottom();
  return msg;
}

function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot", "typing-message");
  typing.innerHTML = `
    <span class="typing-text">Mesajını nəzərdən keçirirəm</span>
    <div class="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  chatBox?.appendChild(typing);
  scrollToBottom();
  return typing;
}

function typeText(el, text, speed = 18) {
  el.innerHTML = "";
  let i = 0;

  const interval = setInterval(() => {
    if (i >= text.length) {
      clearInterval(interval);
      const next = el.nextSibling;
      if (next && next.classList?.contains("msg-floating-left")) {
        next.style.display = "flex";
      }
      return;
    }

    const char = text.charAt(i);
    if (char === "<") {
      const tagEnd = text.indexOf(">", i);
      if (tagEnd !== -1) {
        el.innerHTML += text.substring(i, tagEnd + 1);
        i = tagEnd + 1;
      } else {
        el.innerHTML += char;
        i++;
      }
    } else {
      el.innerHTML += char;
      i++;
    }

    scrollToBottom();
  }, speed);
}

async function sendMessage(message) {
  if (!message.trim()) return;

  if (center) center.style.display = "none";
  if (clearBtn) clearBtn.classList.add("show");
  hideCenterElements();
  hideNewChat();

  addMessage("user", message);
  const typing = showTyping();

  const savedMemory = localStorage.getItem("marketify_memory");
  let finalMessageToSend = message;
  if (savedMemory && savedMemory.trim() !== "") {
    finalMessageToSend = `[Sistem Təlimatı / İstifadəçi Konteksti: ${savedMemory}]\n\nİstifadəçinin Mesajı: ${message}`;
  }

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: finalMessageToSend, model: selectedModel })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Server error");
    }

    if (typing?.parentNode) chatBox?.removeChild(typing);

    let reply = data.reply || "⚠️ Cavab alınmadı 😔";
    reply = marked.parse(reply);
    reply = reply
      .replaceAll("İlk olaraq,", "Başlayaq belə:")
      .replaceAll("Bu addımları izləyə bilərsən", "Gəlin birlikdə baxaq 👇")
      .replaceAll("Nəticədə", "Sonda isə")
      .replaceAll("Bu, sizə kömək edəcək", "Bu sənə real fərq yaradacaq 💡")
      .replaceAll("Uğurlar!", "Uğurlar, sən artıq fərqlisən 🚀");

    const botMsg = addMessage("bot", "");
    typeText(botMsg, reply);
  } catch (err) {
    console.error(err);
    if (typing?.parentNode) chatBox?.removeChild(typing);

    const fallbackMsg =
      err?.message && err.message !== "Server error"
        ? `⚠️ ${err.message}`
        : "⚠️ Bağlantı xətası. Marketify AI hazırda oflayn rejimdədir.";

    addMessage("bot", fallbackMsg);
  }
}

function resetInputState() {
  if (!input) return;
  input.value = "";
  input.style.height = "44px";
  input.style.overflowY = "hidden";
  input.classList.remove("scrolling");
}

function updateInputHeight() {
  if (!input) return;
  const maxHeight = 180;
  input.style.height = "44px";
  const contentHeight = input.scrollHeight;
  const nextHeight = Math.min(contentHeight, maxHeight);
  input.style.height = `${nextHeight}px`;
  if (contentHeight > maxHeight) {
    input.classList.add("scrolling");
  } else {
    input.classList.remove("scrolling");
  }
}

function updateBubbleVisibility() {
  if (!promptContainer || !input) return;
  promptContainer.classList.toggle("hidden-bubbles", input.value.trim().length > 0);
}

function updateSendBtnState() {
  if (!sendBtn || !input) return;
  const hasText = input.value.trim().length > 0;
  sendBtn.disabled = !hasText;
  sendBtn.classList.toggle("disabled", !hasText);
}

function updateCenterState() {
  const hasMessages = chatBox?.children.length > 0;
  const hasText = input?.value.trim().length > 0;
  if (!hasMessages && !hasText) {
    showCenterElements();
    hideNewChat();
    if (center) center.style.display = "flex";
  } else {
    hideCenterElements();
  }
}

if (form && input) {
  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    sendMessage(msg);
    resetInputState();
    updateSendBtnState();
  });

  input.addEventListener("keydown", (e) => {
    if (isMobile()) {
      if (e.key === "Enter") return;
    }

    if (e.key === "Enter" && e.shiftKey) return;

    if (e.key === "Enter") {
      e.preventDefault();
      const msg = input.value.trim();
      if (!msg) return;
      sendMessage(msg);
      resetInputState();
      updateSendBtnState();
    }
  });

  input.addEventListener("input", () => {
    updateInputHeight();
    updateBubbleVisibility();
    updateSendBtnState();

    if (input.value.trim().length > 0) {
      hideCenterElements();
      showNewChat();
    } else if (chatBox && chatBox.children.length === 0) {
      showCenterElements();
      hideNewChat();
    }
  });
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    const lastMessage = chatBox?.querySelector(".message:last-of-type") || chatBox?.lastElementChild;
    if (lastMessage) {
      lastMessage.scrollIntoView({ block: "end", behavior: "smooth" });
    } else if (chatBox) {
      chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
    }
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    confirmPopup?.classList.add("show");
  });
}

if (confirmNo) {
  confirmNo.addEventListener("click", (e) => {
    e.preventDefault();
    confirmPopup?.classList.remove("show");
  });
}

if (confirmYes) {
  confirmYes.addEventListener("click", (e) => {
    e.preventDefault();
    confirmPopup?.classList.remove("show");

    if (chatBox) chatBox.innerHTML = "";
    if (center) center.style.display = "flex";
    showCenterElements();
    hideNewChat();
    promptContainer?.classList.remove("hidden-bubbles");
    clearBtn?.classList.remove("show");
    loadDynamicBubbles();
    updateSendBtnState();

    const notice = document.createElement("div");
    notice.textContent = "💬 Yeni söhbət üçün hazırsan 😎";
    Object.assign(notice.style, {
      position: "fixed",
      bottom: "100px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "linear-gradient(135deg,#2d6bff,#60a5ff)",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: "12px",
      fontFamily: "'Poppins',sans-serif",
      zIndex: "999",
      opacity: "0",
      transition: "opacity 0.4s ease"
    });
    document.body.appendChild(notice);
    setTimeout(() => (notice.style.opacity = "1"), 80);
    setTimeout(() => {
      notice.style.opacity = "0";
      setTimeout(() => notice.remove(), 600);
    }, 2200);
  });
}

const rotatingTaglines = [
  "Bu gün nə haqqında danışırıq? 😊",
  "Marketinq ideyaları ilə dolu bir günə hazırsan? 🚀",
  "Sən yaz, AI düşünsün 💡",
  "Yaradıcı gücünü AI ilə birləşdir ✨",
  "Reklam dünyasında inqilab buradan başlayır 🌍",
  "Bir az sən, bir az AI...",
  "Brendini Marketify AI ilə gücləndir ⚡️",
  "Marketinq gələcəyini bu gündən yarat 🌟",
  "Mətnlər gəlsin, ideyalar axsın ✍️",
  "Az olsun, saz olsun – Marketify AI ilə mükəmməl olsun 👌",
  "Sovetin dövründə belə şey yox idi – amma indi var 😉",
  "Atalar üçdən deyib – sualını yaz, göndər və cavab al ✌️"
];

function initTaglineRotator() {
  if (!taglineEl || rotatingTaglines.length === 0) return;
  let currentIndex = Math.floor(Math.random() * rotatingTaglines.length);
  taglineEl.textContent = rotatingTaglines[currentIndex];

  setInterval(() => {
    taglineEl.classList.add("hide");
    setTimeout(() => {
      currentIndex = (currentIndex + 1) % rotatingTaglines.length;
      taglineEl.textContent = rotatingTaglines[currentIndex];
      taglineEl.classList.remove("hide");
    }, 600);
  }, 5000);
}

function initBottomModelPicker() {
  const trigger = document.getElementById("bottom-model-trigger");
  const menu = document.getElementById("bottom-model-menu");
  const textLabel = document.getElementById("bottom-model-text");
  const items = document.querySelectorAll(".b-model-item");

  if (trigger && menu) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("show");
      trigger.classList.toggle("active");
    });
  }

  document.addEventListener("click", (e) => {
    if (menu && trigger && !menu.contains(e.target) && !trigger.contains(e.target)) {
      menu.classList.remove("show");
      trigger.classList.remove("active");
    }
  });

  items.forEach((item) => {
    item.addEventListener("click", () => {
      const newVal = item.getAttribute("data-val");
      const newName = item.textContent.trim();

      if (typeof selectedModel !== "undefined") {
        selectedModel = newVal;
      }

      if (textLabel) textLabel.textContent = newName;
      items.forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");

      const brand = document.querySelector(".brand");
      const version = document.querySelector(".version");
      if (brand && version) {
        if (newVal === "local") {
          brand.textContent = "Marketify Brain";
          version.textContent = "Beta";
        } else {
          brand.textContent = "Marketify AI";
          version.textContent = "2.0";
        }
      }

      menu?.classList.remove("show");
      trigger?.classList.remove("active");
    });
  });
}

function openModal(id) {
  document.getElementById(id)?.classList.add("show");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("show");
}

function toggleFaq(id, evt) {
  const content = document.getElementById(id);
  if (!content) return;

  content.classList.toggle("open");
  const category = evt?.currentTarget || window.event?.currentTarget;
  if (category) {
    category.classList.toggle("open");
  }
}

function initMobileNav() {
  const navHome = document.getElementById("nav-home");
  const navNewChat = document.getElementById("nav-new-chat");
  const navClear = document.getElementById("nav-clear");
  const navMenu = document.getElementById("nav-menu");
  const allNavBtns = document.querySelectorAll(".nav-btn");

  const setActiveNav = (btn) => {
    allNavBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  };

  const resetToHomeState = () => {
    if (chatBox && chatBox.children.length === 0) {
      showCenterElements();
      hideNewChat();
      if (input) {
        resetInputState();
        input.blur();
      }
    }
  };

  if (navHome) {
    navHome.addEventListener("click", () => {
      setActiveNav(navHome);
      window.scrollTo({ top: 0, behavior: "smooth" });
      resetToHomeState();
      setTimeout(() => navHome.classList.remove("active"), 300);
    });
  }

  if (navNewChat) {
    navNewChat.addEventListener("click", (e) => {
      setActiveNav(navNewChat);
      e.preventDefault();

      if (chatBox && chatBox.children.length > 0) {
        confirmPopup?.classList.add("show");
      } else {
        hideCenterElements();
        showNewChat();
        input?.focus();
      }

      setTimeout(() => navNewChat.classList.remove("active"), 300);
    });
  }

  if (navClear) {
    navClear.addEventListener("click", (e) => {
      setActiveNav(navClear);
      e.preventDefault();
      confirmPopup?.classList.add("show");
      setTimeout(() => navClear.classList.remove("active"), 300);
    });
  }

  if (navMenu) {
    navMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      setActiveNav(navMenu);
      input?.blur();

      dropdownMenu?.classList.toggle("show");
      arrow?.classList.toggle("open");
      setTimeout(() => navMenu.classList.remove("active"), 300);
    });
  }
}

function initClearButtonObserver() {
  const navClear = document.getElementById("nav-clear");
  if (!chatBox || !navClear) return;

  const observer = new MutationObserver(() => {
    if (chatBox.children.length > 0) {
      navClear.classList.remove("hidden-btn");
    } else {
      navClear.classList.add("hidden-btn");
      navClear.classList.remove("active");
    }
  });

  observer.observe(chatBox, { childList: true });
}

(function mobileKeyboardDetection() {
  const body = document.body;

  const isTextInput = (el) =>
    el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

  document.addEventListener(
    "focusin",
    (e) => {
      if (isTextInput(e.target)) body.classList.add("keyboard-open");
    },
    true
  );

  document.addEventListener(
    "focusout",
    () => {
      setTimeout(() => {
        if (!isTextInput(document.activeElement)) body.classList.remove("keyboard-open");
      }, 150);
    },
    true
  );

  if (window.visualViewport) {
    let baseHeight = window.visualViewport.height;
    window.visualViewport.addEventListener("resize", () => {
      if (isTextInput(document.activeElement)) return;
      const diff = baseHeight - window.visualViewport.height;
      if (diff > 120) {
        body.classList.add("keyboard-open");
      } else {
        body.classList.remove("keyboard-open");
      }
    });
  }
})();

function initContactPopup() {
  const contactBtn = document.getElementById("contactBtn");
  const contactPopup = document.getElementById("contactPopup");

  if (contactBtn && contactPopup) {
    contactBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      contactPopup.classList.toggle("show");
      contactPopup.classList.remove("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!contactBtn.contains(e.target) && !contactPopup.contains(e.target)) {
        contactPopup.classList.remove("show");
        contactPopup.classList.add("hidden");
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadDynamicBubbles();
  initTaglineRotator();
  initBottomModelPicker();
  initMobileNav();
  initClearButtonObserver();
  initContactPopup();
  updateBubbleVisibility();
  updateSendBtnState();
  updateCenterState();
});