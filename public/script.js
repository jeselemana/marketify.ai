const chatBox = document.querySelector(".chat-box");
const input = document.querySelector("input");
const sendBtn = document.querySelector(".send");
// 🟣 Hazır prompt bubble-ları
document.querySelectorAll(".bubble").forEach((bubble) => {
  bubble.addEventListener("click", async () => {
    const message = bubble.innerText;

    if (centerMessage) centerMessage.style.display = "none";
    addMessage("user", message);

    const typing = document.createElement("div");
    typing.classList.add("message", "bot", "typing");
    typing.innerText = "Marketify yazır...";
    chatBox.appendChild(typing);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();
      chatBox.removeChild(typing);
      addMessage("bot", data.reply || "Cavab alınmadı 😔");
    } catch (error) {
      chatBox.removeChild(typing);
      addMessage("bot", "⚠️ Bağlantı problemi. Marketify AI hazırda oflayn rejimdədir.");
    }
  });
});
const clearBtn = document.getElementById("clearChat");
const centerMessage = document.querySelector(".center-message");

// 🟢 Mesaj əlavə etmə funksiyası
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerText = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 🟣 “Göndər” düyməsi
sendBtn.addEventListener("click", async () => {
  const message = input.value.trim();
  if (!message) return;

  // Center mesajı gizlət
  if (centerMessage) centerMessage.style.display = "none";

  addMessage("user", message);
  input.value = "";

  const typing = document.createElement("div");
  typing.classList.add("message", "bot", "typing");
  typing.innerText = "Marketify yazır...";
  chatBox.appendChild(typing);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    // 🧠 Cavab yoxdursa
    if (!response.ok) throw new Error("Network response error");
    const data = await response.json();

    chatBox.removeChild(typing);
    addMessage(
  "bot",
  (data.reply || "⚠️ Cavab alınmadı 😔") +
    '\n\n<div class="marketify-cta fade-in">📌 Cavab tam qane etmədi? Narahat olma — həlli Marketify-da!<br> Dərhal <a href="https://marketifym.wixstudio.com/marketify" target="_blank" class="marketify-link">Marketify saytından</a> ekspertlə məsləhətləş və peşəkar dəstək al. 💼</div>'
);
  } catch (error) {
    console.error("Xəta:", error);
    chatBox.removeChild(typing);
    addMessage("bot", "⚠️ Server cavab vermədi. Marketify AI hazırda oflayn rejimdədir.");
  }
});

// 🟢 “Enter” klavişinə tıklama
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

// 🗑️ “Təmizlə” düyməsi
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    chatBox.innerHTML = "";
    if (centerMessage) centerMessage.style.display = "block";
  });
}