const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
let history = [];

function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerText = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

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