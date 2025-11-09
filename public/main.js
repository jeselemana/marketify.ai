const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
let history = [];

// 🟣 Mesaj əlavə etmə funksiyası
function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerText = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// 💬 Typing effekti göstərmə funksiyası
function showTyping() {
  const typingDiv = document.createElement("div");
  typingDiv.className = "msg bot typing";

  typingDiv.innerHTML = `
    <div class="typing-text">Marketify yazır...</div>
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
  `;

  messages.appendChild(typingDiv);
  messages.scrollTop = messages.scrollHeight;
  return typingDiv;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMsg("user", text);
  input.value = "";

  // 🔵 Typing effekti göstər
  const typingDiv = showTyping();

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history }),
    });

    const data = await resp.json();

    // 🟢 Typing effekti sil və cavabı göstər
    typingDiv.remove();
    addMsg("bot", data.reply);

    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: data.reply });
  } catch (error) {
    typingDiv.remove();
    addMsg("bot", "⚠️ Bağlantı xətası. Marketify hazırda oflayn rejimdədir.");
  }
});