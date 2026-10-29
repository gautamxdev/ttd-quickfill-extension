import {test} from "node:test";
import assert from "node:assert/strict";

const person = {name: "Sample Person", age: "30", gender: "Female", idType: "Aadhaar Card", idNumber: "123456789012"};
test("one debugger session fills each field and checks the result", async () => {
  let listener, attached = 0, detached = 0, current, option, hasContent = true, injected = 0;
  const values = new Map(); const commands = [];
  globalThis.chrome = {
    runtime: {id: "test", onInstalled: {addListener() {}}, onStartup: {addListener() {}},
      onMessage: {addListener(fn) { listener = fn; }}, sendMessage: async () => {}},
    sidePanel: {setPanelBehavior: async () => {}},
    scripting: {executeScript: async () => {hasContent = true; injected++;}},
    tabs: {query: async () => [{id: 7, url: "https://ttdevasthanams.ap.gov.in/spat/pilgrim-details?flow=spat"}],
      sendMessage: async (_tab, message) => {
        if (!hasContent) throw Error("Receiving end does not exist");
        const key = `${message.row}:${message.field}`;
        if (message.type === "PING") return {ok: true, result: true};
        if (message.type === "NATIVE_OPTION") return {ok: true, result: null};
        if (message.type === "SCAN") return {ok: true, result: {ready: true, count: 1}};
        if (message.type === "SETTLE") return {ok: true, result: true};
        if (message.type === "POINT") {current = key; return {ok: true, result: {x: 30, y: 50}};}
        if (message.type === "OPTION") {option = message.value; return {ok: true, result: {x: 30, y: 70}};}
        if (message.type === "VERIFY") return {ok: true, result: {found: true, occupied: values.has(key), matches: values.get(key) === message.value, invalid: false}};
        throw Error("unexpected message");
      }},
    debugger: {attach: async () => {attached++;}, detach: async () => {detached++;},
      sendCommand: async (_tab, name, params) => {
        commands.push(name);
        if (name === "Input.insertText") values.set(current, params.text);
        if (name === "Input.dispatchMouseEvent" && params.type === "mouseReleased" && params.y === 70) values.set(current, option);
      }}
  };
  await import(`../service-worker.js?test=${Date.now()}`);
  const response = await new Promise(resolve => listener({source: "TTDQF_V2", type: "FILL", profiles: [person]}, {id: "test"}, resolve));
  assert.equal(response.ok, true, response.error);
  assert.equal(response.result.accepted, 5);
  assert.equal(attached, 1); assert.equal(detached, 1);
  assert.equal(values.get("0:idNumber"), person.idNumber);
  assert.equal(commands.filter(name => name === "Input.insertText").length, 3);
  values.set("0:name", "Existing Person");
  const conflict = await new Promise(resolve => listener({source: "TTDQF_V2", type: "FILL", profiles: [person]}, {id: "test"}, resolve));
  assert.equal(conflict.ok, false);
  assert.match(conflict.error, /different value/);
  assert.equal(values.get("0:name"), "Existing Person");
  assert.equal(commands.filter(name => name === "Input.insertText").length, 3);
  assert.equal(detached, 2);
  values.clear(); hasContent = false;
  const retry = await new Promise(resolve => listener({source: "TTDQF_V2", type: "FILL", profiles: [person]}, {id: "test"}, resolve));
  assert.equal(retry.ok, true, retry.error);
  assert.equal(injected, 1);
  assert.equal(detached, 3);
});
