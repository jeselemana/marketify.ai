(() => {
  let registryPromise;
  const node = (tag, className, text) => { const result = document.createElement(tag); result.className = className || ""; if (text !== undefined) result.textContent = text; return result; };
  const iconPaths = {
    document: ["M6 3h8l4 4v14H6z", "M14 3v5h4M9 12h6M9 16h6"],
    spreadsheet: ["M3 4h18v16H3z", "M3 9h18M9 4v16M15 4v16M3 14h18"],
    presentation: ["M3 3h18v13H3z", "M12 16v5M8 21h8M7 12l3-3 3 2 4-5"],
    pdf: ["M6 3h8l4 4v14H6z", "M14 3v5h4M9 13h6M9 17h4"],
    globe: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z", "M2 12h20M12 2c5 5 5 15 0 20-5-5-5-15 0-20Z"],
    research: ["M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z", "m21 21-4.35-4.35", "M11 7v4l2.5 1.5"],
  };
  function capabilityIcon(type) {
    const wrap = node("span", "ask-plugin-icon"), svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [name, value] of Object.entries({ viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(name, value);
    for (const data of iconPaths[type] || ["M12 3l9 9-9 9-9-9Z"]) { const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", data); svg.append(path); }
    wrap.append(svg); return wrap;
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isEn = () => document.documentElement.lang === "en";
  const request = async url => {
    const response = await fetch(url, { credentials: "same-origin" });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to open file"); return data;
  };
  const registry = () => registryPromise ||= request("/api/ask/plugins").then(data => data.plugins).catch(error => { registryPromise = null; throw error; });
  function attachComposer({ input, body, getSelection, setSelection, disabled = false }) {
    const chips = node("div", "ask-plugin-tokens");
    const popup = node("div", "ask-plugin-selector"); popup.hidden = true; popup.id = `plugin-selector-${input.id}`;
    popup.setAttribute("role", "listbox"); popup.setAttribute("aria-label", isEn() ? "Capabilities" : "Capability seçimi");
    body.prepend(chips); body.append(popup);
    input.setAttribute("aria-controls", popup.id); input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-autocomplete", "list");
    let plugins = [], matches = [], active = 0, queryRange = null;
    const close = () => { popup.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); queryRange = null; };
    const drawChips = () => {
      chips.replaceChildren();
      for (const id of getSelection()) {
        const plugin = plugins.find(item => item.id === id);
        const chip = node("span", "ask-plugin-token");
        chip.append(capabilityIcon(plugin?.icon), node("span", "", `@${plugin?.name || id}`));
        const remove = node("button", "ask-plugin-token-remove", "×"); remove.type = "button"; remove.disabled = disabled;
        remove.setAttribute("aria-label", `${isEn() ? "Remove" : "Sil"} @${plugin?.name || id}`);
        remove.addEventListener("click", () => { setSelection(getSelection().filter(value => value !== id)); drawChips(); input.focus(); }); chip.append(remove); chips.append(chip);
      }
    };
    const choose = plugin => {
      if (!queryRange || plugin.status !== "available") return;
      const ids = getSelection(); if (!ids.includes(plugin.id) && ids.length < 6) setSelection([...ids, plugin.id]);
      const cursor = queryRange.start;
      input.value = input.value.slice(0, queryRange.start) + input.value.slice(queryRange.end);
      input.focus(); input.setSelectionRange(cursor, cursor); input.dispatchEvent(new Event("input", { bubbles: true })); close(); drawChips();
    };
    const drawPopup = () => {
      popup.replaceChildren();
      if (!matches.length) popup.append(node("p", "ask-plugin-empty", isEn() ? "No matching capability" : "Uyğun capability yoxdur"));
      matches.forEach((plugin, index) => {
        const option = node("button", `ask-plugin-option${index === active ? " is-active" : ""}`); option.type = "button";
        option.id = `${popup.id}-${index}`; option.setAttribute("role", "option"); option.setAttribute("aria-selected", String(index === active));
        option.disabled = plugin.status !== "available";
        const copy = node("span", "ask-plugin-option-copy"); copy.append(node("strong", "", `@${plugin.name}`), node("small", "", plugin.status === "available" ? (isEn() ? plugin.descriptionEn || plugin.description : plugin.description) : (isEn() ? "Currently unavailable" : "Hazırda əlçatan deyil")));
        option.append(capabilityIcon(plugin.icon), copy);
        option.addEventListener("pointerdown", event => event.preventDefault()); option.addEventListener("click", () => choose(plugin)); popup.append(option);
      });
      if (matches[active]) input.setAttribute("aria-activedescendant", `${popup.id}-${active}`);
    };
    const search = () => {
      if (disabled) return;
      const cursor = input.selectionStart;
      const match = input.value.slice(0, cursor).match(/(?:^|\s)@([^\s@]*)$/);
      if (!match) return close();
      queryRange = { start: cursor - match[1].length - 1, end: cursor };
      matches = plugins.filter(plugin => !getSelection().includes(plugin.id) && `${plugin.name} ${plugin.description} ${plugin.descriptionEn || ""}`.toLowerCase().includes(match[1].toLowerCase()));
      active = 0; popup.hidden = false; input.setAttribute("aria-expanded", "true"); drawPopup();
    };
    input.addEventListener("input", search); input.addEventListener("click", search);
    input.addEventListener("keydown", event => {
      if (event.isComposing) return;
      if (!popup.hidden && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === "Escape") close();
        else if (["Enter", "Tab"].includes(event.key)) { if (matches[active]) choose(matches[active]); }
        else { active = matches.length ? (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length : 0; drawPopup(); }
      } else if (event.key === "Backspace" && !input.value && getSelection().length) { setSelection(getSelection().slice(0, -1)); drawChips(); }
    }, true);
    input.addEventListener("blur", () => setTimeout(close, 150));
    drawChips();
    registry().then(list => { plugins = list; if (input.isConnected) { drawChips(); search(); } }).catch(() => { if (input.isConnected) { close(); chips.append(node("small", "ask-plugin-empty", isEn() ? "Capabilities could not load. Refresh to retry." : "Capability-lər yüklənmədi. Yenidən yoxlamaq üçün səhifəni yeniləyin.")); } });
  }

  function artifactCard(artifact, onEdit, showPreview = true) {
    if (!uuid.test(artifact.id) || !Number.isInteger(artifact.version) || artifact.version < 1) return null;
    const card = node("div", "ask-artifact-card");
    const info = node("div", "ask-artifact-info"); info.append(node("strong", "", artifact.filename), node("small", "", `${artifact.outputLabel || artifact.pluginId} · ${formatSize(artifact.size)} · v${artifact.version}`));
    const actions = node("div", "ask-artifact-actions");
    const preview = node("button", "ask-artifact-action", isEn() ? "Preview" : "Aç"); preview.type = "button";
    preview.addEventListener("click", () => previewArtifact(artifact, onEdit));
    const download = node("a", "ask-artifact-action", isEn() ? "Download" : "Yüklə"); download.href = `/api/artifacts/${artifact.id}/versions/${artifact.version}/download`; download.download = artifact.filename;
    const edit = node("button", "ask-artifact-action", isEn() ? "Edit" : "Redaktə et"); edit.type = "button"; edit.addEventListener("click", () => onEdit?.(artifact));
    if (showPreview) actions.append(preview);
    actions.append(download, edit); card.append(node("span", "ask-artifact-icon", String(artifact.filename || "").split(".").at(-1).toUpperCase()), info, actions);
    return card;
  }
  const formatSize = size => size >= 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
  function drawTable(container, table) {
    const wrap = node("div", "artifact-preview-table-wrap"), grid = node("table", "artifact-preview-table");
    if (table.headers) { const head = node("tr"); table.headers.forEach(value => head.append(node("th", "", value))); grid.append(head); }
    table.rows.forEach(row => { const tr = node("tr"); row.forEach(value => tr.append(node("td", "", value))); grid.append(tr); });
    wrap.append(grid); container.append(wrap);
  }
  function drawSpec(container, spec, pluginId) {
    container.replaceChildren(node("h1", "", spec.title));
    spec.units.forEach((unit, index) => {
      const section = node("section", "artifact-preview-section");
      section.append(node("h2", "", unit.heading || unit.name || unit.title || `${index + 1}`));
      if (unit.subtitle) section.append(node("p", "", unit.subtitle));
      (unit.paragraphs || []).forEach(value => section.append(node("p", "", value)));
      (unit.lists || []).forEach(list => { const el = node(list.ordered ? "ol" : "ul"); list.items.forEach(value => el.append(node("li", "", value))); section.append(el); });
      if (unit.bullets?.length) { const list = node("ul"); unit.bullets.forEach(value => list.append(node("li", "", value))); section.append(list); }
      if (unit.rows) {
        if (unit.summary) section.append(node("p", "", unit.summary));
        drawTable(section, { rows: unit.rows.slice(0, 200).map(row => row.map(cell => cell.type === "formula" ? `=${cell.formula.replace(/^=/, "")}${cell.result !== null ? ` → ${cell.result}` : ""}` : cell.value)) });
        if (unit.rows.length > 200) section.append(node("small", "", isEn() ? "Download for all rows." : "Bütün sətirlər üçün faylı yükləyin."));
      } else (unit.tables || []).forEach(table => drawTable(section, table));
      (unit.metrics || []).forEach(metric => section.append(node("p", "", `${metric.label}: ${metric.value}`)));
      (unit.charts || []).forEach(chart => { section.append(node("h3", "", chart.title)); drawTable(section, { headers: ["", ...chart.series.map(series => series.name)], rows: chart.labels.map((label, ci) => [label, ...chart.series.map(series => String(series.values[ci]))]) }); });
      if (unit.notes) { const details = node("details"); details.append(node("summary", "", isEn() ? "Speaker notes" : "Spiker qeydləri"), node("p", "", unit.notes)); section.append(details); }
      container.append(section);
    });
    if (spec.citations.length) {
      const list = node("ul"); spec.citations.forEach(cite => { if (!/^https?:\/\//i.test(cite.url)) return; const li = node("li"), link = node("a", "", cite.title); link.href = cite.url; link.target = "_blank"; link.rel = "noopener noreferrer"; li.append(link); list.append(li); }); container.append(list);
    }
  }
  async function previewArtifact(artifact, onEdit) {
    const dialog = node("dialog", "artifact-preview-dialog");
    const toolbar = node("div", "artifact-preview-toolbar");
    const title = node("strong", "", artifact.filename), select = node("select", "artifact-version-select"), close = node("button", "ask-artifact-action", "×");
    select.setAttribute("aria-label", isEn() ? "Version history" : "Versiya tarixçəsi"); close.type = "button"; close.setAttribute("aria-label", isEn() ? "Close preview" : "Önbaxışı bağla"); close.addEventListener("click", () => dialog.close());
    toolbar.append(title, select, close);
    const content = node("div", "artifact-preview-body", isEn() ? "Loading..." : "Yüklənir..."); dialog.append(toolbar, content); document.body.append(dialog); dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    let loadId = 0;
    const load = async version => {
      const currentLoad = ++loadId;
      try {
        const data = await request(`/api/artifacts/${artifact.id}/versions/${version}/preview`);
        if (currentLoad !== loadId || !dialog.isConnected) return;
        title.textContent = data.artifact.filename;
        select.replaceChildren(); data.versions.forEach(item => { const option = node("option", "", `v${item.version} · ${new Date(item.createdAt).toLocaleString()}`); option.value = item.version; option.selected = item.version === Number(version); select.append(option); });
        drawSpec(content, data.specification, data.artifact.pluginId);
        const card = artifactCard(data.artifact, selected => { dialog.close(); onEdit?.(selected); }, false); if (card) content.prepend(card);
      } catch (error) { if (currentLoad !== loadId || !dialog.isConnected) return; content.replaceChildren(node("p", "ask-error", error.message)); const retry = node("button", "ask-artifact-action", isEn() ? "Retry" : "Yenidən cəhd et"); retry.addEventListener("click", () => load(version)); content.append(retry); }
    };
    select.addEventListener("change", () => load(select.value)); await load(artifact.version);
  }
  window.HelmerArtifacts = { attachComposer, artifactCard };
})();
