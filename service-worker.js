import {plan} from "./plan.js";
import {detectFlow} from "./flows.js";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let running = false;

chrome.runtime.onInstalled.addListener(() => chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}));
chrome.runtime.onStartup.addListener(() => chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}));

async function read(tabId, type, extra = {}) {
  const response = await chrome.tabs.sendMessage(tabId, {source: "TTDQF_V2", type, ...extra});
  if (!response?.ok) throw Error(response?.error || "Cannot inspect the TTD form. Refresh it and retry.");
  return response.result;
}
async function command(tabId, name, params) {
  return chrome.debugger.sendCommand({tabId}, name, params);
}
async function ensureContent(tabId) {
  try { await read(tabId, "PING"); }
  catch {
    await chrome.scripting.executeScript({target: {tabId}, files: ["content.js"]});
    await read(tabId, "PING");
  }
}
async function key(tabId, key, code = key, windowsVirtualKeyCode) {
  const params = {key, code, ...(windowsVirtualKeyCode ? {windowsVirtualKeyCode} : {})};
  await command(tabId, "Input.dispatchKeyEvent", {type: "keyDown", ...params});
  await command(tabId, "Input.dispatchKeyEvent", {type: "keyUp", ...params});
}
async function click(tabId, point) {
  if (!point) throw Error("A required control is missing.");
  const {x, y} = point;
  await command(tabId, "Input.dispatchMouseEvent", {type: "mousePressed", x, y, button: "left", clickCount: 1});
  await command(tabId, "Input.dispatchMouseEvent", {type: "mouseReleased", x, y, button: "left", clickCount: 1});
}
async function typeKeys(tabId, value) {
  for (const character of value) {
    await command(tabId, "Input.dispatchKeyEvent", {type: "keyDown", key: character, text: character, unmodifiedText: character});
    await command(tabId, "Input.dispatchKeyEvent", {type: "keyUp", key: character});
  }
}
async function until(fn, timeout = 1400) {
  const end = performance.now() + timeout;
  do {
    const found = await fn();
    if (found) return found;
    await delay(40);
  } while (performance.now() < end);
  return null;
}
function notify(tabId, message) {
  chrome.runtime.sendMessage({source: "TTDQF_V2", type: "PROGRESS", tabId, message}).catch(() => {});
}

async function fill(tabId, profiles) {
  const start = performance.now();
  const form = await until(async () => {
    const state = await read(tabId, "SCAN");
    return state.ready ? state : null;
  }, 3500);
  if (!form) throw Error("Pilgrim fields are not ready. Select a slot and wait for the form.");
  const steps = plan(profiles, form.count);
  await chrome.debugger.attach({tabId}, "1.3");
  let accepted = 0;
  try {
    for (const step of steps) {
      const {row, field, value} = step;
      const previous = await read(tabId, "VERIFY", step);
      if (previous.matches && !previous.invalid) { accepted++; continue; }
      if (previous.occupied) throw Error(`Row ${row + 1} ${field} has a different value. Check it manually.`);
      const point = await until(() => read(tabId, "POINT", {row, field}));
      if (!point) throw Error(`Row ${row + 1} ${field} is unavailable.`);
      await click(tabId, point);
      if (field === "gender" || field === "idType") {
        const native = await read(tabId, "NATIVE_OPTION", step);
        if (native) {
          if (native.index < 0) throw Error(`Cannot find ${value} in row ${row + 1} dropdown.`);
          await key(tabId, "Home", "Home", 36);
          for (let index = 0; index < native.index; index++) await key(tabId, "ArrowDown", "ArrowDown", 40);
          await key(tabId, "Enter", "Enter", 13);
          await key(tabId, "Tab", "Tab", 9);
        } else {
          const option = await until(() => read(tabId, "OPTION", {value}));
          if (!option) throw Error(`Cannot find ${value} in row ${row + 1} dropdown.`);
          await click(tabId, option);
        }
      } else {
        await command(tabId, "Input.insertText", {text: value});
      }
      // Leave the field before accepting it: controlled forms may reset on blur.
      if (field !== "gender" && field !== "idType") {
        await command(tabId, "Input.dispatchKeyEvent", {type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9});
        await command(tabId, "Input.dispatchKeyEvent", {type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9});
      }
      await read(tabId, "SETTLE");
      let verified = await until(async () => {
        const state = await read(tabId, "VERIFY", step);
        return state.matches && !state.invalid ? state : null;
      }, 650);
      if (!verified && !["gender", "idType"].includes(field)) {
        const state = await read(tabId, "VERIFY", step);
        if (state.occupied) throw Error(`Row ${row + 1} ${field} changed but did not match. Check it manually.`);
        const retryPoint = await read(tabId, "POINT", {row, field});
        await click(tabId, retryPoint);
        await typeKeys(tabId, value);
        await command(tabId, "Input.dispatchKeyEvent", {type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9});
        await command(tabId, "Input.dispatchKeyEvent", {type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9});
        await read(tabId, "SETTLE");
        verified = await until(async () => {
          const current = await read(tabId, "VERIFY", step);
          return current.matches && !current.invalid ? current : null;
        }, 650);
      }
      if (!verified) throw Error(`Row ${row + 1} ${field} was not accepted. Check it manually.`);
      accepted++;
      notify(tabId, `${accepted}/${steps.length} fields checked`);
    }
    await read(tabId, "SETTLE");
    for (const step of steps) {
      const check = await read(tabId, "VERIFY", step);
      if (!check.matches || check.invalid) throw Error(`Row ${step.row + 1} ${step.field} did not persist. Review before Continue.`);
    }
    return {accepted, total: steps.length, elapsedMs: Math.round(performance.now() - start)};
  } finally {
    await chrome.debugger.detach({tabId}).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message?.source !== "TTDQF_V2") return false;
  if (message.type !== "INSPECT" && message.type !== "FILL") return false;
  (async () => {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const flow = detectFlow(tab?.url);
    if (!tab?.id || !flow) throw Error("Open a Sri PAT, SED or Angapradakshinam pilgrim-details form in the active tab.");
    await ensureContent(tab.id);
    if (message.type === "INSPECT") return {...await read(tab.id, "SCAN"), flow};
    if (message.type !== "FILL") throw Error("Unknown action.");
    if (running) throw Error("A fill is already running.");
    running = true;
    try { return await fill(tab.id, message.profiles); }
    finally { running = false; }
  })().then(result => reply({ok: true, result}), error => reply({ok: false, error: error.message}));
  return true;
});
