// =========================================================
// MARKETIFY AI - SCRIPT.JS (SADƏLƏŞDİRİLMİŞ VƏ TƏKƏRSİZ VERSİYA)
// =========================================================

// 1. ⚙️ ƏSAS ELEMENTLƏRİN DÜZGÜN TƏYİN OLUNMASI
// index.html ID-lərinə uyğun olmalıdır
const modelButton = document.getElementById("model-btn");
const dropdown = document.getElementById("dropdownMenu");
const arrow = document.querySelector(".arrow-down");
const clearBtn = document.getElementById("clearChat");
const chatBox = document.getElementById("chat-box");
const centerView = document.getElementById("center-view");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const bubbles = document.querySelectorAll(".bubble");

// Popup elementləri
const confirmPopup = document.getElementById("confirmPopup");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");


// 2. 🟣 KÖMƏKÇİ FUNKSİYALAR
function scrollToBottom() {
  requestAnimationFrame(() => {
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
  });
}

function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  scrollToBottom();
  return msg;
}

function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot", "typing");
  typing.textContent = "Marketify yazır...";
  chatBox.appendChild(typing);
  scrollToBottom();
  return typing;
}

function typeText(element, text, speed = 20) {
  element.textContent = "";
  let i = 0;
  const interval = setInterval(() => {
    element.textContent += text.charAt(i);
    i++;
    scrollToBottom();
    if (i >= text.length) clearInterval(interval);
  }, speed);
}

// 3. 🔵 ƏSAS GÖNDƏRMƏ FUNKSİYASI
async function sendMessage(message) {
  if (!message.trim()) return;

  centerView.style.display = "none";
  addMessage("user", message);
  const typing = showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) throw new Error("Server error");

    const data = await response.json();
    chatBox.removeChild(typing);

    // Style tətbiq et
    let reply = data.reply || "⚠️ Cavab alınmadı 😔";
    reply = reply
      .replaceAll("İlk olaraq,", "Başlayaq belə:")
      // (Qalan style tətbiqləri buradadır)

    const botMsg = addMessage("bot", "");
    typeText(botMsg, reply, 18);
  } catch (error) {
    console.error(error);
    chatBox.removeChild(typing);
    addMessage("bot", "⚠️ Bağlantı xətası. Marketify AI hazırda oflayn rejimdədir.");
  }
}

// 4. 🖱️ EVENT LISTENERS (DÜĞMƏLƏRİN İŞƏ SALINMASI)

// A. Model Dropdown
if (modelButton && dropdown && arrow) {
  modelButton.addEventListener("click", () => {
    dropdown.classList.toggle("show");
    arrow.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!modelButton.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove("show");
      arrow.classList.remove("open");
    }
  });
}

// B. Göndərmə Formu (Submit) və Enter
if (chatForm && userInput) {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;
    sendMessage(message);
    userInput.value = "";
  });

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const message = userInput.value.trim();
      if (!message) return;
      sendMessage(message);
      userInput.value = "";
    }
  });
}

// C. Bubble klikləri
bubbles.forEach((bubble) => {
  bubble.addEventListener("click", () => {
    const message = bubble.innerText;
    bubbles.forEach((b) => (b.style.display = "none"));
    sendMessage(message);
  });
});

// D. Təmizlə (Clear) və Popup
if (clearBtn) {
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    confirmPopup.classList.add("show");
  });
}

if (confirmNo) {
  confirmNo.onclick = (e) => {
    e.preventDefault();
    confirmPopup.classList.remove("show");
  };
}

if (confirmYes) {
  confirmYes.onclick = async (e) => {
    e.preventDefault();
    confirmPopup.classList.remove("show");

    try {
      await fetch("/api/clear", { method: "POST" });
    } catch (err) {
      console.error("Clear error:", err);
    }

    chatBox.innerHTML = "";
    centerView.style.display = "flex";
    bubbles.forEach((b) => (b.style.display = "inline-block"));

    // Bildiriş göstər (notice funksiyası burada davam edir)
    // ...
  };
}

// Qalan bütün əlavə funksiyalarınız (Shake detection, Tagline, Suggestions) buraya əlavə olunmalıdır.
// Əvvəlki mesajımdakı tam funksiyaları (DOMContentLoaded daxilindəkilər də daxil) bura kopyalayın.