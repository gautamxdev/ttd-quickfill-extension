import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

test("finds both rows and waits for ID number to become editable", () => {
  let listener;
  const names = ["Name", "Age", "Gender", "Photo ID Proof", "Photo Id Number"];
  const inputs = [0, 1].flatMap(row => names.map((name, index) => ({
    id: `${row}-${index}`, name: "", type: "text", value: "", disabled: index === 4,
    isConnected: true, parentElement: {querySelector: () => null},
    getAttribute: () => "", closest: () => null, scrollIntoView() {},
    getBoundingClientRect: () => ({left: 10, top: 10 + row * 100, width: 100, height: 30})
  })));
  const labels = inputs.map((input, index) => ({htmlFor: input.id, textContent: names[index % 5]}));
  const document = {
    querySelectorAll: selector => selector === "label[for]" ? labels : selector.startsWith("main input") ? inputs : [],
    getElementById: () => null
  };
  runInNewContext(readFileSync(new URL("../content.js", import.meta.url), "utf8"), {
    location: {hostname: "ttdevasthanams.ap.gov.in"}, document,
    getComputedStyle: () => ({visibility: "visible"}),
    chrome: {runtime: {onMessage: {addListener(fn) { listener = fn; }}}}
  });
  const send = message => {let response; listener({source: "TTDQF_V2", ...message}, {}, result => {response = result;}); return response.result;};
  assert.deepEqual(Array.from(send({type: "SCAN"}).fields[0]), names.slice(0, 4).map((_, i) => ["name", "age", "gender", "idType"][i]));
  assert.equal(send({type: "SCAN"}).count, 2);
  assert.equal(send({type: "POINT", row: 0, field: "idNumber"}), null);
  inputs[4].disabled = false;
  assert.deepEqual({...send({type: "POINT", row: 0, field: "idNumber"})}, {x: 60, y: 25});
  inputs[0].value = "Sample Person";
  assert.equal(send({type: "VERIFY", row: 0, field: "name", value: "Sample Person"}).matches, true);
  assert.equal(send({type: "VERIFY", row: 1, field: "name", value: "Sample Person"}).matches, false);
  inputs[2].value = "Select Gender";
  assert.equal(send({type: "VERIFY", row: 0, field: "gender", value: "Female"}).occupied, false);
  inputs[3].value = "Aadhaar Card";
  inputs[3].disabled = true;
  assert.equal(send({type: "VERIFY", row: 0, field: "idType", value: "Aadhaar Card"}).matches, true);
  assert.equal(send({type: "POINT", row: 0, field: "idType"}), null);
});
