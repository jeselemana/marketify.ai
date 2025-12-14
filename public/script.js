/* ==========================================================================
   MARKETIFY AI - OPTIMIZED CORE SCRIPT
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // 🎯 DOM ELEMENTLƏRİ
  const DOM = {
    modelBtn: document.getElementById("model-btn"),
    dropdownMenu: document.getElementById("dropdownMenu"),
    arrow: document.querySelector(".arrow-down"),
    clearBtn: document.getElementById("clearChat"),
    navClear: document.getElementById("nav-clear"), // Mobil nav üçün
    chatBox: document.getElementById("chat-box"),
    promptContainer: document.querySelector(".prompt-bubbles"),
    form: document.getElementById("chat-form"),
    input: document.getElementById("user-input"),
    sendBtn: document.getElementById("send-btn"), // Send button
    centerView: document.getElementById("center-view"), // Hero container
    brandSub: document.querySelector(".brand-sub"), // "Marketify AI"
    tagline: document.querySelector(".tagline"),
    newChatHeader: document.getElementById("newChat"), // "Yeni Söhbət"
    newDynamicTitle: document.querySelector(".new-dynamic-title"),
    newDisclaimer: document.querySelector(".new-chat-disclaimer"),
    confirmPopup: document.getElementById("confirmPopup"),
    confirmYes: document.getElementById("confirmYes"),
    confirmNo: document.getElementById("confirmNo"),
    bottomModelTrigger: document.getElementById("bottom-model-trigger"),
    bottomModelMenu: document.getElementById("bottom-model-menu"),
    bottomModelText: document.getElementById("bottom-model-text"),
    contactBtn: document.getElementById("contactBtn"),
    contactPopup: document.getElementById("contactPopup")
  };

  // ⚙️ QLOBAL DƏYİŞƏNLƏR
  let selectedModel = "gpt-4o";

  /* ============================================
     🛠 UTILITY FUNCTIONS (Köməkçi Funksiyalar)
     ============================================ */
  
  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const lastMessage = DOM.chatBox?.lastElementChild;
      if (lastMessage) {
        lastMessage.scrollIntoView({ block: "end", behavior: "smooth" });
      } else {
        DOM.chatBox.scrollTo({ top: DOM.chatBox.scrollHeight, behavior: "smooth" });
      }
    });
  }

  // Mesajları hərf-hərf yazan funksiya
  function typeText(el, text, speed = 18) {
    el.innerHTML = "";
    let i = 0;
    const interval = setInterval(() => {
      if (i >= text.length) {
        clearInterval(interval);
        // Mesaj bitdikdə əlavə düymələr varsa göstər
        const next = el.nextSibling;
        if (next && next.classList.contains("msg-floating-left")) {
          next.style.display = "flex";
        }
        return;
      }
      const char = text.charAt(i);
      // HTML teqlərini bütöv yazırıq
      if (char === '<') {
        const tagEnd = text.indexOf('>', i);
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

  /* ============================================
     💬 CHAT LOGIC (Core System)
     ============================================ */

  function addMessage(role, text) {
    const msg = document.createElement("div");
    msg.classList.add("message", role);
    msg.innerHTML = text;
    DOM.chatBox.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  function showTyping() {
    const typing = document.createElement("div");
    typing.classList.add("message", "bot", "typing-message");
    typing.innerHTML = `
      <span class="typing-text">Mesajını nəzərdən keçirirəm</span>
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    `;
    DOM.chatBox.appendChild(typing);
    scrollToBottom();
    return typing;
  }

  // 🔥 VAHİD SEND MESSAGE FUNKSİYASI
  async function sendMessage(message) {
    if (!message.trim()) return;

    // 1. UI STATE UPDATE (Mesaj gedən kimi hər şeyi gizlət)
    DOM.centerView.style.display = "none"; // Bubbles, Logo və s.
    
    // Headerləri gizlət (Həm Brand, həm New Chat)
    if (DOM.brandSub) DOM.brandSub.style.opacity = "0";
    if (DOM.tagline) DOM.tagline.style.opacity = "0";
    if (DOM.newDynamicTitle) DOM.newDynamicTitle.classList.remove("show");
    if (DOM.newDisclaimer) DOM.newDisclaimer.classList.remove("show");
    
    // Clear düyməsini göstər
    if (DOM.clearBtn) DOM.clearBtn.classList.add("show");
    if (DOM.navClear) DOM.navClear.classList.remove("hidden-btn"); // Mobil üçün

    // 2. Mesajı ekrana əlavə et
    addMessage("user", message);
    const typing = showTyping();

    // 3. Yaddaş məntiqi (Context)
    const savedMemory = localStorage.getItem('marketify_memory');
    let finalMessageToSend = message;
    if (savedMemory && savedMemory.trim() !== "") {
      finalMessageToSend = `[Sistem Təlimatı: ${savedMemory}]\n\nİstifadəçi: ${message}`;
    }

    // 4. API Sorğusu
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: finalMessageToSend, model: selectedModel }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");

      if (typing?.parentNode) DOM.chatBox.removeChild(typing);

      let reply = data.reply || "⚠️ Cavab alınmadı 😔";
      
      // Markdown parse (əgər kitabxana qoşulubsa)
      if (typeof marked !== 'undefined') {
          reply = marked.parse(reply);
      }

      // Tone of Voice düzəlişləri
      reply = reply
        .replaceAll("İlk olaraq,", "Başlayaq belə:")
        .replaceAll("Bu addımları izləyə bilərsən", "Gəlin birlikdə baxaq 👇")
        .replaceAll("Uğurlar!", "Uğurlar, sən fərqlisən 🚀");

      const botMsg = addMessage("bot", "");
      typeText(botMsg, reply);

    } catch (err) {
      console.error(err);
      if (typing?.parentNode) DOM.chatBox.removeChild(typing);
      const fallbackMsg = err?.message || "⚠️ Bağlantı xətası.";
      addMessage("bot", fallbackMsg);
    }
  }

  /* ============================================
     🎛 UI STATE MANAGEMENT (Input Listener)
     ============================================ */

  // Bütün input dəyişikliklərini idarə edən mərkəzi funksiya
  function handleInputState() {
    const val = DOM.input.value;
    const isEmpty = val.trim().length === 0;
    const isChatEmpty = DOM.chatBox.children.length === 0;

    // 1. Send Button
    if (DOM.sendBtn) {
        DOM.sendBtn.disabled = isEmpty;
        DOM.sendBtn.classList.toggle("disabled", isEmpty);
    }

    // 2. Input Hündürlüyü (Auto-grow)
    DOM.input.style.height = "44px";
    const scrollH = DOM.input.scrollHeight;
    if(scrollH > 180) {
        DOM.input.style.height = "180px";
        DOM.input.classList.add("scrolling");
    } else {
        DOM.input.style.height = scrollH + "px";
        DOM.input.classList.remove("scrolling");
    }

    // 3. Əgər çatda mesaj VARSA, heç bir header göstərmə
    if (!isChatEmpty) return; 

    // 4. Çat BOŞDURSA: "Yeni Söhbət" vs "Ana Ekran" məntiqi
    if (!isEmpty) {
        // İstifadəçi yazır -> Ana ekranı gizlət, "Yeni Söhbət"i göstər
        if (DOM.centerView) DOM.centerView.style.display = "none"; // Logo & Bubbles getsin
        if (DOM.promptContainer) DOM.promptContainer.classList.add("hidden-bubbles");

        if (DOM.brandSub) DOM.brandSub.style.opacity = "0";
        if (DOM.tagline) DOM.tagline.style.opacity = "0";

        if (DOM.newDynamicTitle) DOM.newDynamicTitle.classList.add("show");
        if (DOM.newDisclaimer) DOM.newDisclaimer.classList.add("show");
    } else {
        // Input boşdur -> Ana ekranı geri qaytar
        if (DOM.centerView) DOM.centerView.style.display = "block"; // Logo geri gəlsin
        if (DOM.promptContainer) DOM.promptContainer.classList.remove("hidden-bubbles");

        if (DOM.brandSub) DOM.brandSub.style.opacity = "1";
        if (DOM.tagline) DOM.tagline.style.opacity = "1";

        if (DOM.newDynamicTitle) DOM.newDynamicTitle.classList.remove("show");
        if (DOM.newDisclaimer) DOM.newDisclaimer.classList.remove("show");
    }
  }

  // Tək bir Listener əlavə edirik
  if (DOM.input) {
    DOM.input.addEventListener("input", handleInputState);
    
    // Klaviatura Enter idarəetməsi
    DOM.input.addEventListener("keydown", (e) => {
        if (isMobile() && e.key === "Enter") return; // Mobildə yeni sətir
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            DOM.form.dispatchEvent(new Event("submit")); // Formu submit et
        }
    });
  }

  // Form Submit Handler
  if (DOM.form) {
    DOM.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const msg = DOM.input.value.trim();
      if (!msg) return;
      
      sendMessage(msg);
      
      // Inputu sıfırla
      DOM.input.value = "";
      DOM.input.style.height = "44px";
      DOM.input.classList.remove("scrolling");
      
      // UI-ı yenilə (Send button disable olsun deyə)
      handleInputState();
    });
  }

  /* ============================================
     🛁 CLEAR CHAT & POPUP LOGIC
     ============================================ */
  
  function clearChatUI() {
    // 1. Çatı təmizlə
    DOM.chatBox.innerHTML = "";
    
    // 2. Inputu təmizlə
    DOM.input.value = "";
    handleInputState(); // State-i sıfırla
    
    // 3. Ana ekranı bərpa et
    DOM.centerView.style.display = "block";
    if (DOM.promptContainer) DOM.promptContainer.classList.remove("hidden-bubbles");
    loadDynamicBubbles(); // Yeni bubble-lar
    
    // 4. Clear düyməsini gizlət
    if (DOM.clearBtn) DOM.clearBtn.classList.remove("show");
    if (DOM.navClear) DOM.navClear.classList.add("hidden-btn");

    // 5. Bildiriş (Toast)
    showToast("💬 Yeni söhbət üçün hazırsan 😎");
  }

  function showToast(text) {
    const notice = document.createElement("div");
    notice.textContent = text;
    Object.assign(notice.style, {
      position: "fixed", bottom: "100px", left: "50%", transform: "translateX(-50%)",
      background: "linear-gradient(135deg,#2d6bff,#60a5ff)", color: "#fff",
      padding: "12px 20px", borderRadius: "12px", zIndex: "999", opacity: "0", transition: "opacity 0.4s ease"
    });
    document.body.appendChild(notice);
    setTimeout(() => (notice.style.opacity = "1"), 80);
    setTimeout(() => {
        notice.style.opacity = "0";
        setTimeout(() => notice.remove(), 600);
    }, 2200);
  }

  if (DOM.clearBtn) DOM.clearBtn.addEventListener("click", () => DOM.confirmPopup.classList.add("show"));
  if (DOM.confirmNo) DOM.confirmNo.addEventListener("click", () => DOM.confirmPopup.classList.remove("show"));
  if (DOM.confirmYes) DOM.confirmYes.addEventListener("click", () => {
      DOM.confirmPopup.classList.remove("show");
      clearChatUI();
  });

  /* ============================================
     🎈 DYNAMIC BUBBLES
     ============================================ */
  const promptSuggestions = [
    { title: "Growth Hacking", sub: "strategiyasını düzgün tətbiq etmə yolları" },
    { title: "Black Friday-də", sub: "sərfəli təkliflərlə yanaşı mənfəət artırmaq" },
    { title: "Instagram Reels", sub: "üçün viral ssenari yaz" },
    { title: "SMM strategiyası", sub: "3 aylıq mini plan ver" },
    { title: "Startup ideyası", sub: "üçün SWOT analizi et" },
    { title: "Reklam sloqanı", sub: "qısa və yaddaqalan olsun" }
  ];

  function loadDynamicBubbles() {
    if (!DOM.promptContainer) return;
    DOM.promptContainer.innerHTML = "";
    const selected = promptSuggestions.sort(() => Math.random() - 0.5).slice(0, 4);

    selected.forEach(item => {
      const btn = document.createElement("button");
      btn.className = "bubble";
      btn.innerHTML = `<div class="bubble-content"><span class="bubble-title">${item.title}</span><span class="bubble-sub">${item.sub}</span></div>`;
      btn.addEventListener("click", () => {
        DOM.input.value = `${item.title} ${item.sub}`;
        DOM.input.focus();
        handleInputState(); // Input dəyişdi, state-i yenilə
      });
      DOM.promptContainer.appendChild(btn);
    });
  }
  
  loadDynamicBubbles(); // Start

  /* ============================================
     🔄 TAGLINE ROTATOR
     ============================================ */
  const rotatingTaglines = [
    "Bu gün nə haqqında danışırıq? 😊",
    "Marketinq ideyaları ilə dolu bir günə hazırsan? 🚀",
    "Sən yaz, AI düşünsün 💡"
  ];

  function initTaglineRotator() {
    if (!DOM.tagline) return;
    let idx = 0;
    DOM.tagline.textContent = rotatingTaglines[0];
    
    setInterval(() => {
        DOM.tagline.classList.add("hide");
        setTimeout(() => {
            idx = (idx + 1) % rotatingTaglines.length;
            DOM.tagline.textContent = rotatingTaglines[idx];
            DOM.tagline.classList.remove("hide");
        }, 600);
    }, 5000);
  }
  
  initTaglineRotator();

  /* ============================================
     🎚 MODEL DROPDOWN LOGIC (Bottom Selector)
     ============================================ */
  if (DOM.bottomModelTrigger && DOM.bottomModelMenu) {
      DOM.bottomModelTrigger.addEventListener("click", (e) => {
          e.stopPropagation();
          DOM.bottomModelMenu.classList.toggle("show");
          DOM.bottomModelTrigger.classList.toggle("active");
      });

      document.addEventListener("click", (e) => {
          if (!DOM.bottomModelMenu.contains(e.target) && !DOM.bottomModelTrigger.contains(e.target)) {
              DOM.bottomModelMenu.classList.remove("show");
              DOM.bottomModelTrigger.classList.remove("active");
          }
      });

      document.querySelectorAll(".b-model-item").forEach(item => {
          item.addEventListener("click", () => {
              const newVal = item.dataset.val;
              selectedModel = newVal;
              if (DOM.bottomModelText) DOM.bottomModelText.textContent = item.textContent.trim();
              
              document.querySelectorAll(".b-model-item").forEach(i => i.classList.remove("selected"));
              item.classList.add("selected");
              
              DOM.bottomModelMenu.classList.remove("show");
              DOM.bottomModelTrigger.classList.remove("active");
          });
      });
  }

  /* ============================================
     📱 MOBILE NAVIGATION
     ============================================ */
  const navBtns = document.querySelectorAll(".nav-btn");
  function setNavActive(btn) {
      navBtns.forEach(b => b.classList.remove("active"));
      if(btn) btn.classList.add("active");
  }

  // Nav: Home
  const navHome = document.getElementById("nav-home");
  if(navHome) {
      navHome.addEventListener("click", () => {
          setNavActive(navHome);
          if (DOM.chatBox.children.length === 0) {
              // Yalnız çat boşdursa ana ekrana qaytar
              DOM.input.value = "";
              handleInputState();
              DOM.input.blur();
          }
      });
  }

  // Nav: New Chat
  const navNewChat = document.getElementById("nav-new-chat");
  if(navNewChat) {
      navNewChat.addEventListener("click", (e) => {
          e.preventDefault();
          setNavActive(navNewChat);
          if (DOM.chatBox.children.length > 0) {
              DOM.confirmPopup.classList.add("show"); // Mesaj varsa silmək təklif et
          } else {
              DOM.input.focus(); // Boşdursa yazmağa başla
          }
          setTimeout(() => navNewChat.classList.remove("active"), 300);
      });
  }

  // Nav: Clear
  if(DOM.navClear) {
      DOM.navClear.addEventListener("click", (e) => {
          e.preventDefault();
          setNavActive(DOM.navClear);
          DOM.confirmPopup.classList.add("show");
          setTimeout(() => DOM.navClear.classList.remove("active"), 300);
      });
  }

  /* ============================================
     📧 CONTACT POPUP
     ============================================ */
  if(DOM.contactBtn && DOM.contactPopup) {
      DOM.contactBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          DOM.contactPopup.classList.toggle("show");
          DOM.contactPopup.classList.remove("hidden");
      });
      document.addEventListener("click", (e) => {
          if (!DOM.contactBtn.contains(e.target) && !DOM.contactPopup.contains(e.target)) {
              DOM.contactPopup.classList.remove("show");
          }
      });
  }

  /* ============================================
     🌐 GLOBALS (Modallar üçün)
     ============================================ */
  window.openModal = (id) => document.getElementById(id)?.classList.add("show");
  window.closeModal = (id) => document.getElementById(id)?.classList.remove("show");
  
  window.toggleFaq = (id) => {
      document.getElementById(id)?.classList.toggle("open");
      event.currentTarget.classList.toggle("open");
  };

}); // DOMContentLoaded SONU