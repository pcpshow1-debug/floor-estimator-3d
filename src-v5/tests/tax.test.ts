import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretDorLookup, parseDorText } from "../lib/pricing/tax";

describe("WA DOR tax lookup", () => {
  it("parses the official text format", () => {
    const parsed = parseDorText("LocationCode=1726 Rate=.1055 ResultCode=5");
    assert.equal(parsed.locationCode, "1726");
    assert.equal(parsed.rate, 0.1055);
    assert.equal(parsed.resultCode, 5);
  });

  it("does not treat a ZIP-only result as a confirmed destination rate", () => {
    const result = interpretDorLookup({ rate: 0.1055, resultCode: 5, hasStreet: false, locationCode: "1726" });
    assert.equal(result.confirmed, false);
    assert.equal(result.rate, 0.1055);
    assert.match(result.note, /ZIP-level/);
    assert.match(result.note, /not a confirmed destination-specific rate/);
  });

  it("confirms an address-level result", () => {
    const result = interpretDorLookup({ rate: 0.103, resultCode: 0, hasStreet: true, locationCode: "1726", jurisdiction: "SEATTLE" });
    assert.equal(result.confirmed, true);
    assert.equal(result.rate, 0.103);
  });
});
