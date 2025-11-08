document.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chat-box");
  const input = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const clearBtn = document.getElementById("clearChat");
  const centerMessage = document.querySelector(".center-message");
  const bubbles = document.querySelectorAll(".bubble");

  // 🟢 Mesaj əlavə etmə funksiyası (Markdown dəstəyi ilə)
  function addMessage(sender, text) {
    const msg = document.createElement("div");
    msg.classList.add("message", sender);
    msg.innerHTML = marked.parse(text);
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // ✉️ Mesaj göndərmə funksiyası (Göndər və bubble-lar üçün)
  async function sendMessage(message) {
    if (!message) return;

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
      addMessage("bot", data.reply || "⚠️ Cavab alınmadı 😔");
    } catch (error) {
      console.error("Xəta:", error);
      chatBox.removeChild(typing);
      addMessage(
        "bot",
        "⚠️ Server cavab vermədi. Marketify AI hazırda oflayn rejimdədir."
      );
    }
  }

  // 🟣 “Göndər” düyməsi
  sendBtn.addEventListener("click", () => {
    const message = input.value.trim();
    if (!message) return;
    sendMessage(message);
    input.value = "";
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

  // 💡 Hazır prompt bubble-lar
  bubbles.forEach((bubble) => {
    bubble.addEventListener("click", () => {
      const text = bubble.innerText.trim();
      sendMessage(text);
    });
  });
});