import {test} from "node:test";
import assert from "node:assert/strict";
import {detectFlow} from "../flows.js";

test("recognizes all three pilgrim routes and query-based pilgrim sections", () => {
  for (const id of ["spat", "sed", "apd"]) {
    assert.equal(detectFlow(`https://ttdevasthanams.ap.gov.in/${id}/pilgrim-details?section=slot-booking`).id, id);
    assert.equal(detectFlow(`https://ttdevasthanams.ap.gov.in/${id}/slot-booking?section=pilgrim-details`).id, id);
    assert.equal(detectFlow(`https://ttdevasthanams.ap.gov.in/pilgrim-details?flow=${id}`).id, id);
  }
});
test("recognizes the combined SED page, while the worker still requires pilgrim fields", () => {
  assert.equal(detectFlow("https://ttdevasthanams.ap.gov.in/sed/slot-booking-acc").id, "sed");
  assert.equal(detectFlow("https://ttdevasthanams.ap.gov.in/apd/slot-booking-acc"), null);
});
test("rejects other origins, receipts, unrelated flows and slot-only pages", () => {
  for (const value of ["not a url", "http://ttdevasthanams.ap.gov.in/sed/pilgrim-details",
    "https://ttdevasthanams.ap.gov.in.evil.test/apd/pilgrim-details",
    "https://ttdevasthanams.ap.gov.in/sed/receipt", "https://ttdevasthanams.ap.gov.in/login",
    "https://ttdevasthanams.ap.gov.in/accommodation/pilgrim-details",
    "https://ttdevasthanams.ap.gov.in/apd/slot-booking"]) assert.equal(detectFlow(value), null);
});
