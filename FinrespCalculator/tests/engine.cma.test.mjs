import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./harness/load-engine.mjs";
import { makeCandles, ALL_INDICATORS } from "./helpers/candles.mjs";

const E = loadEngine();

test("CMA: power 0 equals SMA", () => {
  const closes = [100, 101, 102, 103, 104, 105, 106, 107];
  const len = 3;
  const sma = E.smaSeries(closes, len);
  const cma = E.cmaSeries(closes, len, 0);
  for (let i = 0; i < closes.length; i++) {
    if (sma[i] == null) continue;
    assert.ok(Math.abs(sma[i] - cma[i]) < 1e-9, `bar ${i}: ${sma[i]} vs ${cma[i]}`);
  }
});

test("CM logic resolves to cma_spread and runs", () => {
  const line = E.DEFAULT_LOGIC_LINES.CM;
  assert.ok(line.includes("CMA"));
  const candles = makeCandles("GAZP", 300);
  const spec = E.resolveLogicSpec("CM", {}, E.DEFAULT_PARAMS, ALL_INDICATORS);
  assert.equal(spec.type, "cma_spread");
  assert.equal(spec.cmaLen, 100);
  assert.equal(spec.cmaPow, 1);
  assert.equal(spec.side, "above");
  const r = E.runOnCandles(candles, spec, 50, 290, E.DEFAULT_PARAMS, E.DEFAULT_VOLUME, { sec: "GAZP" });
  assert.ok(r.rows.length > 0);
  assert.ok((r.buys + r.sells) > 0);
  const probe = E.probeLogicSignalsAtBar(candles, spec, E.DEFAULT_PARAMS, { barIndex: 120, pos: 0 });
  assert.equal(probe.ready, true);
  assert.equal(probe.cmaModel, true);
  assert.equal(probe.logicId, "CM");
});
