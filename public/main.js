const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
let history = [];

// 🟢 Mesaj əlavə etmə funksiyası
function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;

  // Əgər bot cavabıdırsa, altına 👍 👎 düymələri əlavə edirik
  if (role === "bot") {
    div.innerHTML = `
      <div class="bot-text">${text}</div>
      <div class="feedback">
        <button class="like">👍</button>
        <button class="dislike">👎</button>
      </div>
    `;

    // Feedback düymələrini dinləyirik
    const likeBtn = div.querySelector(".like");
    const dislikeBtn = div.querySelector(".dislike");

    likeBtn.addEventListener("click", () => sendFeedback("like", text));
    dislikeBtn.addEventListener("click", () => sendFeedback("dislike", text));
  } else {
    div.innerText = text; // İstifadəçi mesajı
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// 💬 Feedback göndərmə funksiyası
async function sendFeedback(type, replyText) {
  try {
    const resp = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedback: type,
        reply: replyText,
      }),
    });

    if (resp.ok) {
      alert("Rəyin uğurla göndərildi ✅");
    } else {
      alert("⚠️ Rəy göndərilə bilmədi.");
    }
  } catch (err) {
    console.error("Feedback xətası:", err);
    alert("⚠️ Bağlantı xətası, rəy göndərilmədi.");
  }
}

// 💌 Chat form
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMsg("user", text);
  input.value = "";

  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text, history }),
  });

  const data = await resp.json();
  addMsg("bot", data.reply);
  history.push({ role: "user", content: text });
  history.push({ role: "assistant", content: data.reply });
});