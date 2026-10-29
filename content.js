(() => {
  if (location.hostname !== "ttdevasthanams.ap.gov.in") return;
  if (globalThis.__TTDQF_V2_LOADED__) return;
  globalThis.__TTDQF_V2_LOADED__ = true;
  const wanted = ["name", "age", "gender", "idType", "idNumber"];
  let rows = [];

  function visible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }
  function classify(label) {
    const t = String(label || "").toLowerCase().replace(/\s+/g, " ");
    if (/(photo\s*id|identity|id\s*proof).*(number|no\b)|\bid\s*number\b/.test(t)) return "idNumber";
    if (/photo\s*id\s*proof|\bid\s*(proof|type)\b|\bidentity\b/.test(t)) return "idType";
    if (/\bgender\b|\bsex\b/.test(t)) return "gender";
    if (/\bage\b/.test(t)) return "age";
    if (/\bname\b/.test(t)) return "name";
    return null;
  }
  function label(el) {
    const explicit = el.id && Array.from(document.querySelectorAll("label[for]"))
      .find(node => node.htmlFor === el.id)?.textContent;
    const aria = el.getAttribute("aria-labelledby")?.split(/\s+/)
      .map(id => document.getElementById(id)?.textContent || "").join(" ");
    const sibling = el.parentElement?.querySelector("label")?.textContent;
    return [el.getAttribute("aria-label"), el.getAttribute("placeholder"), explicit,
      el.closest("label")?.textContent, sibling, aria, el.name, el.id].filter(Boolean).join(" ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
  }
  function scan() {
    const inputs = Array.from(document.querySelectorAll('main input, main select, main [role="combobox"]'))
      .filter(el => visible(el) && !["hidden", "checkbox", "radio", "submit", "button"].includes(el.type))
      .filter(el => !el.querySelector?.("input, select"));
    const matched = inputs.map(el => ({el, field: classify(label(el))})).filter(item => item.field);
    rows = [];
    for (const item of matched) {
      if (item.field === "name") rows.push({name: item.el});
      else if (rows.length && !rows.at(-1)[item.field]) rows.at(-1)[item.field] = item.el;
    }
    return {
      count: rows.length,
      fields: rows.map(row => wanted.filter(key => row[key] && !row[key].disabled)),
      ready: rows.length > 0 && rows.every(row => ["name", "age", "gender", "idType"].every(key => row[key]))
    };
  }
  function field(row, key, allowDisabled = false) {
    scan();
    const el = rows[row]?.[key];
    return el?.isConnected && visible(el) && (allowDisabled || !el.disabled) ? el : null;
  }
  function point(el) {
    el.scrollIntoView({block: "center", inline: "nearest"});
    const rect = el.getBoundingClientRect();
    return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
  }
  function option(text) {
    const choices = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li'))
      .filter(el => visible(el) && el.getAttribute("aria-disabled") !== "true" && el.textContent?.trim().toLowerCase() === text.toLowerCase());
    return choices.length === 1 ? point(choices[0]) : null;
  }
  function result(message) {
    if (message.type === "PING") return true;
    if (message.type === "SCAN") return scan();
    if (message.type === "POINT") {
      const el = field(message.row, message.field);
      return el ? point(el) : null;
    }
    if (message.type === "OPTION") return option(message.value);
    if (message.type === "NATIVE_OPTION") {
      const el = field(message.row, message.field);
      if (el?.tagName !== "SELECT") return null;
      const options = Array.from(el.options).filter(option => !option.disabled);
      return {index: options.findIndex(option => option.textContent.trim().toLowerCase() === message.value.toLowerCase())};
    }
    if (message.type === "VERIFY") {
      const el = field(message.row, message.field, true);
      if (!el) return {found: false, matches: false};
      let current = String(el.tagName === "SELECT" ? el.selectedOptions[0]?.textContent || "" : el.value ?? el.textContent ?? "").trim();
      if (/^(select|choose)(\b.*)?$|^--.*--$/i.test(current)) current = "";
      const expected = String(message.value).trim();
      const invalid = el.getAttribute("aria-invalid") === "true";
      const matches = ["gender", "idType"].includes(message.field) ? current.toLowerCase() === expected.toLowerCase() : current === expected;
      return {found: true, occupied: current.length > 0, matches, invalid};
    }
    return null;
  }
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message?.source !== "TTDQF_V2") return false;
    if (message.type === "SETTLE") {
      requestAnimationFrame(() => requestAnimationFrame(() => reply({ok: true, result: true})));
      return true;
    }
    try { reply({ok: true, result: result(message)}); }
    catch (error) { reply({ok: false, error: String(error.message)}); }
    return false;
  });
})();
