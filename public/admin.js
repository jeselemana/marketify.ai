async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString("az-AZ");
}

// 📊 Statistika
async function loadStats() {
  const elTemplates = document.getElementById("stat-templates");
  const elIntents = document.getElementById("stat-intents");
  const elLogs = document.getElementById("stat-logs");

  try {
    const stats = await fetchJSON("/admin/api/stats");
    elTemplates.textContent = stats.totalTemplates ?? 0;
    elIntents.textContent = stats.totalIntents ?? 0;
    elLogs.textContent = stats.totalLogEntries ?? 0;
  } catch (err) {
    console.error("Stats xətası:", err);
    elTemplates.textContent = "–";
    elIntents.textContent = "–";
    elLogs.textContent = "–";
  }
}

// 🧠 Şablonları göstər
async function loadTemplates() {
  const container = document.getElementById("templates-container");
  container.innerHTML = "";

  try {
    const { base, trash } = await fetchJSON("/admin/api/templates");
    const intents = Object.keys(base || {});

    if (!intents.length) {
      container.innerHTML =
        '<p class="hint">Hələ heç bir şablon öyrənilməyib. Marketify bir az işləsin, sonra geri qayıdarsan. 😊</p>';
      return;
    }

    intents.forEach((intent) => {
      const items = Array.isArray(base[intent]) ? base[intent] : [];
      const trashItems = Array.isArray(trash?.[intent]) ? trash[intent] : [];

      const block = document.createElement("div");
      block.className = "intent-block";

      const header = document.createElement("div");
      header.className = "intent-header";

      const left = document.createElement("div");
      const name = document.createElement("div");
      name.className = "intent-name";
      name.textContent = intent;

      const count = document.createElement("div");
      count.className = "intent-count";
      count.textContent = `Aktiv: ${items.length} | Trash: ${trashItems.length}`;

      left.appendChild(name);
      left.appendChild(count);

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "kliklə aç/bağla";

      header.appendChild(left);
      header.appendChild(badge);

      const list = document.createElement("div");
      list.className = "intent-templates";
      list.style.display = "none";

      // aktiv template-lər
      items.forEach((t, index) => {
        const item = document.createElement("div");
        item.className = "template-item";

        const text = document.createElement("div");
        text.className = "template-text";
        text.textContent = t.template;

        const meta = document.createElement("div");
        meta.className = "template-meta";

        const info = document.createElement("span");
        info.textContent = `Əlavə olunub: ${
          t.createdAt ? formatDate(t.createdAt) : "–"
        }`;

        const btn = document.createElement("button");
        btn.className = "btn btn-danger";
        btn.textContent = "Trash-a at";
        btn.addEventListener("click", async () => {
          if (
            !confirm(
              `Bu şablonu trash-a atmaq istədiyinə əminsən? [${intent} #${index}]`
            )
          )
            return;
          await fetchJSON("/admin/api/templates/delete", {
            method: "POST",
            body: JSON.stringify({ intent, index }),
          });
          await loadTemplates();
          await loadStats();
        });

        meta.appendChild(info);
        meta.appendChild(btn);

        item.appendChild(text);
        item.appendChild(meta);
        list.appendChild(item);
      });

      // trash-dən bərpa edilə bilənlər
      trashItems.forEach((t, index) => {
        const item = document.createElement("div");
        item.className = "template-item";

        const text = document.createElement("div");
        text.className = "template-text";
        text.textContent = t.template;

        const meta = document.createElement("div");
        meta.className = "template-meta";

        const info = document.createElement("span");
        info.textContent = `Trash: ${
          t.deletedAt ? formatDate(t.deletedAt) : "–"
        }`;

        const btn = document.createElement("button");
        btn.className = "btn btn-ghost";
        btn.textContent = "Bərpa et";
        btn.addEventListener("click", async () => {
          await fetchJSON("/admin/api/templates/restore", {
            method: "POST",
            body: JSON.stringify({ intent, index }),
          });
          await loadTemplates();
          await loadStats();
        });

        meta.appendChild(info);
        meta.appendChild(btn);

        item.appendChild(text);
        item.appendChild(meta);
        list.appendChild(item);
      });

      header.addEventListener("click", () => {
        list.style.display = list.style.display === "none" ? "block" : "none";
      });

      block.appendChild(header);
      block.appendChild(list);
      container.appendChild(block);
    });
  } catch (err) {
    console.error("Templates xətası:", err);
    container.innerHTML =
      '<p class="hint">Template-ləri yükləmək mümkün olmadı. Konsolu yoxla.</p>';
  }
}

// 📜 Log-lar
async function loadLogs() {
  const container = document.getElementById("logs-container");
  container.innerHTML = "";

  try {
    const { entries } = await fetchJSON("/admin/api/logs?limit=30");

    if (!entries || !entries.length) {
      container.innerHTML =
        '<p class="hint">Hələ log yoxdur. GPT cavabları gəldikcə bura dolacaq. 🧠</p>';
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "log-item";

      const q = document.createElement("div");
      q.className = "log-question";
      q.textContent = entry.question;

      const intent = document.createElement("div");
      intent.className = "log-intent";
      intent.textContent = `Intent: ${entry.intent || "unknown"}`;

      const time = document.createElement("div");
      time.className = "log-time";
      time.textContent = formatDate(entry.timestamp);

      item.appendChild(q);
      item.appendChild(intent);
      item.appendChild(time);

      container.appendChild(item);
    });
  } catch (err) {
    console.error("Logs xətası:", err);
    container.innerHTML =
      '<p class="hint">Log-ları yükləmək mümkün olmadı. Konsolu yoxla.</p>';
  }
}

async function initAdmin() {
  await loadStats();
  await loadTemplates();
  await loadLogs();
}

document.addEventListener("DOMContentLoaded", () => {
  initAdmin().catch((e) => console.error(e));
});