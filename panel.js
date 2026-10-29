import {validate} from "./plan.js";

let profiles = [];
let selected = [];
let editing = null;
const $ = id => document.getElementById(id);
const form = $("profile-form");
const status = text => { $("status").textContent = text; };
async function save() { await chrome.storage.local.set({profiles, selected}); }
function request(type, extra = {}) {
  return chrome.runtime.sendMessage({source: "TTDQF_V2", type, ...extra}).then(message => {
    if (!message?.ok) throw Error(message?.error || "Could not contact QuickFill.");
    return message.result;
  });
}
function render() {
  const container = $("profiles");
  container.replaceChildren();
  if (!profiles.length) container.textContent = "No pilgrims saved yet.";
  for (const person of profiles) {
    const card = document.createElement("div"); card.className = "person";
    const label = document.createElement("label");
    const checkbox = document.createElement("input"); checkbox.type = "checkbox";
    checkbox.checked = selected.includes(person.id);
    checkbox.addEventListener("change", async () => {
      selected = checkbox.checked ? [...selected, person.id] : selected.filter(id => id !== person.id);
      await save(); render();
    });
    label.append(checkbox, document.createTextNode(person.name || "Incomplete pilgrim"));
    const detail = document.createElement("small");
    const order = selected.indexOf(person.id);
    detail.textContent = `${order >= 0 ? `Row ${order + 1} • ` : ""}${person.idType || "ID type needed"} • ${person.age || "age needed"}`;
    const actions = document.createElement("div"); actions.className = "row";
    const edit = document.createElement("button"); edit.textContent = "Edit";
    edit.addEventListener("click", () => openForm(person));
    const remove = document.createElement("button"); remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      if (!confirm(`Remove ${person.name} from QuickFill?`)) return;
      profiles = profiles.filter(item => item.id !== person.id);
      selected = selected.filter(id => id !== person.id);
      await save(); render();
    });
    actions.append(edit, remove); card.append(label, detail, actions); container.append(card);
  }
}
function openForm(person = null) {
  editing = person?.id || null;
  $("form-title").textContent = person ? "Edit pilgrim" : "Add pilgrim";
  form.hidden = false; form.reset();
  for (const key of ["name", "age", "gender", "idType", "idNumber"]) form.elements[key].value = person?.[key] || "";
}
function closeForm() { form.hidden = true; editing = null; form.reset(); }
$("add").addEventListener("click", () => openForm());
$("cancel").addEventListener("click", closeForm);
form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  for (const key of Object.keys(data)) data[key] = data[key].trim();
  const problems = validate(data);
  if (problems.length) { status(`Check ${problems.join(", ")}.`); return; }
  const entry = {...data, id: editing || crypto.randomUUID()};
  profiles = editing ? profiles.map(p => p.id === editing ? entry : p) : [...profiles, entry];
  await save(); closeForm(); render(); status("Pilgrim saved on this computer.");
});
$("import").addEventListener("change", async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== "ttd-quickfill-profiles" || !Array.isArray(data.profiles)) throw Error("Not an old QuickFill backup.");
    let count = 0;
    for (const old of data.profiles) {
      if (!old.fullName || !old.photoIdNumber) continue;
      profiles.push({id: crypto.randomUUID(), name: old.fullName, age: "", gender: "",
        idType: old.photoIdType || "", idNumber: old.photoIdNumber}); count++;
    }
    await save(); render(); status(`Imported ${count} pilgrims. Edit each one to add Age and Gender.`);
  } catch (error) { status(error.message); }
  event.target.value = "";
});
$("inspect").addEventListener("click", async () => {
  try {
    const form = await request("INSPECT");
    $("detected").textContent = `${form.flow.name}: ${form.ready ? `${form.count} pilgrim rows found.` : "Pilgrim fields are not ready. Open the pilgrim details section."}`;
  } catch (error) { $("detected").textContent = error.message; }
});
$("fill").addEventListener("click", async () => {
  $("fill").disabled = true;
  try {
    const chosen = selected.map(id => profiles.find(p => p.id === id)).filter(Boolean);
    const result = await request("FILL", {profiles: chosen});
    status(`${result.accepted}/${result.total} fields checked in ${(result.elapsedMs / 1000).toFixed(2)} s. Review before Continue.`);
  } catch (error) { status(error.message); }
  finally { $("fill").disabled = false; }
});
chrome.runtime.onMessage.addListener(message => {
  if (message?.source === "TTDQF_V2" && message.type === "PROGRESS") status(message.message);
});
const saved = await chrome.storage.local.get({profiles: [], selected: []});
profiles = saved.profiles; selected = saved.selected;
render(); $("inspect").click();
