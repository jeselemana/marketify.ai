/* 1. Bütün lazımi HTML elementlərini seçirik */
const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const centerMessage = document.querySelector(".center-message");
const clearChatBtn = document.getElementById("clearChat");

/* 2. "Göndər" düyməsinə klikləmə hadisəsi təyin edirik */
sendBtn.addEventListener("click", sendMessage);

/* 3. "Enter" düyməsinə basıldıqda da işləməsi üçün hadisə təyin edirik */
userInput.addEventListener("keydown", (event) => {
  // Əgər basılan düymə "Enter"dirsə
  if (event.key === "Enter") {
    sendMessage(); // "Göndər" düyməsinə basılmış kimi et
  }
});

/* 4. Əsas mesaj göndərmə funksiyası */
function sendMessage() {
  const userMessage = userInput.value.trim(); // Yazılan mətni al və boşluqları təmizlə

  // Əgər input boşdursa, heç nə etmə
  if (userMessage === "") {
    return;
  }

  // ---- ƏN VACİB HİSSƏ ----
  // 1. Mərkəzdəki "Marketify" yazısını gizlət
  centerMessage.style.display = "none";

  // 2. İstifadəçinin mesajını HTML olaraq yarat
  // (Siz marked.js qoşmusunuz, ona görə "marked.parse" istifadə edirəm)
  const userMessageHTML = `
    <div class="message user-message">
      <div class="message-content">
        ${marked.parse(userMessage)} 
      </div>
    </div>
  `;
  // Qeyd: Əgər "user-message" CSS klassınız yoxdursa, onu əlavə etməlisiniz.

  // 3. Mesajı çat pəncərəsinə əlavə et
  chatBox.insertAdjacentHTML("beforeend", userMessageHTML);

  // 4. Input-un içini təmizlə
  userInput.value = "";

  // 5. Avtomatik aşağı çək (scroll)
  chatBox.scrollTop = chatBox.scrollHeight;

  // 6. (Gələcək üçün) AI cavabını burada emal edə bilərsiniz
  // getAiResponse(userMessage);
}

/* 5. Söhbəti təmizləmə düyməsi üçün məntiq */
clearChatBtn.addEventListener("click", () => {
  chatBox.innerHTML = ""; // Bütün mesajları sil
  centerMessage.style.display = "flex"; // Mərkəzdəki yazını geri qaytar
  // Qeyd: CSS-də .center-message-i necə mərkəzləşdirdiyinizə görə "flex" və ya "block" ola bilər.
});