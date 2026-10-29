import {test} from "node:test";
import assert from "node:assert/strict";
import {classify, plan, validate} from "../plan.js";

const person = {name: "Sample Person", age: "30", gender: "Female", idType: "Aadhaar Card", idNumber: "1234 5678 9012"};
test("maps the five Sri PAT fields in each pilgrim row", () => {
  const steps = plan([person, {...person, name: "Another Person"}], 2);
  assert.deepEqual(steps.map(s => `${s.row}:${s.field}`), [
    "0:name", "0:age", "0:gender", "0:idType", "0:idNumber",
    "1:name", "1:age", "1:gender", "1:idType", "1:idNumber"
  ]);
  assert.equal(steps[4].value, "123456789012");
});
test("rejects a wrong row count and incomplete ID details before filling", () => {
  assert.throws(() => plan([person], 2), /exactly 2/);
  assert.deepEqual(validate({...person, idNumber: "1234"}), ["12-digit ID number"]);
  assert.deepEqual(validate({...person, age: ""}), ["age"]);
});
test("classifies ID number before its broader ID proof label", () => {
  assert.equal(classify("Photo Id Number *"), "idNumber");
  assert.equal(classify("Photo ID Proof *"), "idType");
  assert.equal(classify("Age *"), "age");
});
