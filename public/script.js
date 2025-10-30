const chatBox = document.querySelector(".chat-box");
const input = document.querySelector("input");
const sendBtn = document.querySelector(".send");
const clearBtn = document.getElementById("clearChat");
const centerMessage = document.querySelector(".center-message");

// Mesaj əlavə etmə funksiyası
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerText = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// “Göndər” düyməsi
sendBtn.addEventListener("click", async () => {
  const message = input.value.trim();
  if (!message) return;

  addMessage("user", message);
  input.value = "";

  const typing = document.createElement("div");
  typing.classList.add("message", "bot", "typing");
  typing.innerText = "Marketify yazır...";
  chatBox.appendChild(typing);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    // 🔹 BACKEND URL — Render serverində bu cür çağırılmalıdır
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

// Enter klavişini işlək et
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

// “Təmizlə” düyməsi
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    chatBox.innerHTML = "";
    if (centerMessage) centerMessage.style.display = "block";
  });
}