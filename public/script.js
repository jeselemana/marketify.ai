const $ = (selector) => document.querySelector(selector);

const root = document.documentElement;
const sidebar = $('#leftSidebar') || $('#sidebar') || $('.sidebar');
const brandPanel = $('#rightContext') || $('#brandPanel') || $('.brand-panel');
const sidebarToggle = $('#leftToggle') || $('#sidebarToggle');
const contextToggle = $('#rightToggle') || $('#contextToggle');
const overlay = $('#mobileOverlay');
const mobileMenuBtn = $('#mobileMenuBtn');
const themeBtn = $('#themeBtn');
const newChatBtn = $('#newChatBtn');
const chatForm = $('#chatForm');
const userInput = $('#userInput');
const sendBtn = $('#sendBtn');
const chatBox = $('#chatBox');
const hero = $('#hero');
const heroTitle = $('#heroTitle');
const quickGrid = $('#quickGrid');
const modelSelect = $('#modelSelect');
const saveContextBtn = $('#saveContext');

const contextFields = {
  brandName: $('#brandName'),
  industry: $('#industry'),
  audience: $('#audience'),
  tone: $('#tone'),
};

const STORE = {
  theme: 'marketify:v2:theme',
  context: 'marketify:v2:brand-context',
};


function setPanelPinned(panel, toggle, pinned, options) {
  panel?.classList.toggle('pinned', pinned);
  panel?.classList.toggle('is-collapsed', !pinned);
  if (!toggle) return;

  toggle.setAttribute('aria-expanded', String(pinned));
  toggle.setAttribute('aria-pressed', String(pinned));
  toggle.setAttribute('aria-label', pinned ? options.unpinLabel : options.pinLabel);
  toggle.textContent = pinned ? options.pinnedIcon : options.collapsedIcon;
}

function setSidebarPinned(pinned) {
  setPanelPinned(sidebar, sidebarToggle, pinned, {
    pinLabel: 'Sidebar sabitlə',
    unpinLabel: 'Sidebar sabitliyini söndür',
    collapsedIcon: '›',
    pinnedIcon: '‹',
  });
}

function setContextPinned(pinned) {
  setPanelPinned(brandPanel, contextToggle, pinned, {
    pinLabel: 'Kontekst panelini sabitlə',
    unpinLabel: 'Kontekst panelinin sabitliyini söndür',
    collapsedIcon: '‹',
    pinnedIcon: '›',
  });
}

function initPanels() {
  setSidebarPinned(false);
  setContextPinned(false);
}

function isDesktopPanelMode() {
  return matchMedia('(min-width: 821px)').matches;
}

function handleCollapsedPanelClick(event, panel, togglePinned) {
  if (!isDesktopPanelMode() || panel.classList.contains('pinned')) return;
  if (!panel.classList.contains('is-collapsed')) return;
  if (event.target.closest('button, input, select, textarea, a')) return;
  togglePinned(true);
}

function setTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem(STORE.theme, next);
  themeBtn.textContent = next === 'light' ? 'Gecə' : 'Gündüz';
}

function initTheme() {
  const saved = localStorage.getItem(STORE.theme);
  const system = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  setTheme(saved || system);
}

function getContext() {
  return {
    brandName: contextFields.brandName.value.trim(),
    industry: contextFields.industry.value.trim(),
    audience: contextFields.audience.value.trim(),
    tone: contextFields.tone.value,
  };
}

function saveContext() {
  localStorage.setItem(STORE.context, JSON.stringify(getContext()));
  toastBot('Kontekst yadda saxlandı. İndi cavablar daha brendə uyğun gələcək.');
}

function loadContext() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE.context) || '{}');
    Object.entries(contextFields).forEach(([key, el]) => {
      if (saved[key] && el) el.value = saved[key];
    });
  } catch { }
}

function buildPrompt(message) {
  const ctx = getContext();
  const filled = Object.entries(ctx).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join('\n');
  if (!filled) return message;
  return `Marketify AI Brand Context:\n${filled}\n\nİstifadəçi istəyi:\n${message}`;
}

function setChatMode() {
  hero.style.display = 'none';
  heroTitle.textContent = 'Workspace';
}

function resetChat() {
  chatBox.innerHTML = '';
  hero.style.display = '';
  heroTitle.textContent = 'Bu gün nə yaradırıq?';
  userInput.value = '';
  resizeInput();
  userInput.focus();
}

function addMessage(role, content, options = {}) {
  const msg = document.createElement('div');
  msg.className = `message ${role}${options.loading ? ' loading' : ''}`;
  msg.textContent = content;

  if (role === 'bot' && !options.loading) {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.innerHTML = `
      <button type="button" data-action="copy">Copy</button>
      <button type="button" data-action="shorter">Qısalt</button>
      <button type="button" data-action="premium">Daha premium</button>
    `;
    msg.appendChild(actions);
  }

  chatBox.appendChild(msg);
  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
  return msg;
}

function toastBot(text) {
  setChatMode();
  addMessage('bot', text);
}

function cleanReply(text) {
  return (text || 'Cavab alınmadı.')
    .replace(/\*\*/g, '')
    .replace(/`+/g, '')
    .replace(/^>\s?/gm, '')
    .trim();
}

async function sendMessage(message) {
  const raw = message.trim();
  if (!raw) return;

  setChatMode();
  addMessage('user', raw);
  const loading = addMessage('bot', 'Mesajını analiz edirəm...', { loading: true });

  sendBtn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: buildPrompt(raw),
        model: modelSelect.value || 'gpt-4o',
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Server cavab vermədi');

    loading.remove();
    addMessage('bot', cleanReply(data.reply));
  } catch (error) {
    loading.remove();
    addMessage('bot', `Bağlantı xətası: ${error.message || 'Marketify AI hazırda cavab verə bilmir.'}`);
  } finally {
    sendBtn.disabled = false;
  }
}

function resizeInput() {
  userInput.style.height = 'auto';
  userInput.style.height = `${Math.min(userInput.scrollHeight, 180)}px`;
  sendBtn.disabled = !userInput.value.trim();
}

quickGrid.addEventListener('click', (event) => {
  const card = event.target.closest('[data-prompt]');
  if (!card) return;
  userInput.value = card.dataset.prompt;
  resizeInput();
  userInput.focus();
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const message = userInput.value;
  if (!message.trim()) return;
  userInput.value = '';
  resizeInput();
  sendMessage(message);
});

userInput.addEventListener('input', resizeInput);
userInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

themeBtn.addEventListener('click', () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light'));
sidebarToggle?.addEventListener('click', () => setSidebarPinned(!sidebar.classList.contains('pinned')));
contextToggle?.addEventListener('click', () => setContextPinned(!brandPanel.classList.contains('pinned')));
sidebar?.addEventListener('click', (event) => handleCollapsedPanelClick(event, sidebar, setSidebarPinned));
brandPanel?.addEventListener('click', (event) => handleCollapsedPanelClick(event, brandPanel, setContextPinned));
newChatBtn.addEventListener('click', resetChat);
saveContextBtn.addEventListener('click', saveContext);

mobileMenuBtn?.addEventListener('click', () => {
  sidebar.classList.add('open');
  overlay.classList.add('show');
});
overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
});

chatBox.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const message = button.closest('.message');
  const text = message.childNodes[0]?.textContent || message.textContent;

  if (button.dataset.action === 'copy') navigator.clipboard?.writeText(text);
  if (button.dataset.action === 'shorter') sendMessage(`Bu cavabı daha qısa və konkret et:\n\n${text}`);
  if (button.dataset.action === 'premium') sendMessage(`Bu cavabı daha premium, daha satış yönümlü formada yenilə:\n\n${text}`);
});

initPanels();
initTheme();
loadContext();
resizeInput();
