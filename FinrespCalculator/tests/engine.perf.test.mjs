/**
 * Регрессионные тесты производительности движка (Node).
 *
 * Ловят: внезапное замедление runOnCandles / runMulti / live-tail на 31 инстр.
 * Не ловят: T-Bank API, IndexedDB, отрисовку графиков в браузере — это B2/ручной smoke.
 *
 * Пороги откалиброваны на dev-машине; запас PERF_FACTOR (по умолчанию 2.5).
 * Ужесточить локально: set PERF_FACTOR=1 && npm run test:perf
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./harness/load-engine.mjs";
import { ALL_INDICATORS, makeCandles } from "./helpers/candles.mjs";
import { benchSync, perfLimit, assertUnder } from "./helpers/perf.mjs";
import { simulateLiveTailFinresp } from "./helpers/live-tail.mjs";

const E = loadEngine();

const SHARE_TICKERS = [
  "AFLT", "ALRS", "AFKS", "BSPB", "CHMF", "FEES", "GAZP", "GMKN", "HYDR", "IRAO",
  "LKOH", "MAGN", "MOEX", "MTSS", "MTLRP", "NVTK", "NLMK", "PLZL", "PIKK", "PHOR",
  "ROSN", "RUAL", "RTKMP", "SBER", "SBERP", "SNGSP", "SNGS", "TATN", "TATNP", "UPRO", "VTBR"
];

const LIVE_LOGIC_IDS = [
  "TBC", "UT", "UCT", "L5", "L1", "L2", "L3", "L4",
  "sma_below", "sma_above", "sma_corridor_trend", "sma_corridor_anti"
];

const TAIL_BARS = 220;
const vol = { deposit: 7000, maxPositions: 10, volume: 10 };

function packs31(barCount) {
  return SHARE_TICKERS.map((sec, i) => makeCandles(sec, barCount, { startPrice: 20 + (i % 17) * 3 }));
}

describe("perf: live-tail path (31 instruments)", () => {
  it("sma_below tail — типичный лёгкий расчёт", () => {
    const packs = packs31(300);
    const spec = E.resolveLogicSpec("sma_below", {}, E.DEFAULT_PARAMS, ALL_INDICATORS);
    const ms = benchSync(() => {
      simulateLiveTailFinresp(E, packs, spec, E.DEFAULT_PARAMS, vol, TAIL_BARS);
    });
    assertUnder(ms, perfLimit(200), "live-tail sma_below x31 x300 bars");
  });

  it("полный стек логик — как в UI по умолчанию", () => {
    const packs = packs31(300);
    const spec = E.resolveLogicSpecStack(LIVE_LOGIC_IDS, {}, E.DEFAULT_PARAMS, ALL_INDICATORS);
    const result = simulateLiveTailFinresp(E, packs, spec, E.DEFAULT_PARAMS, vol, TAIL_BARS);
    assertUnder(result.totalMs, perfLimit(2500), "live-tail full stack x31 x300 bars");
    assert.equal(result.perSec.length, 31);
    assertUnder(result.maxMs, perfLimit(200), "live-tail max per instrument (300 bars)");
    assertUnder(result.avgMs, perfLimit(120), "live-tail avg per instrument (300 bars)");
  });

  it("длинная история (2500 баров) — как в кэше браузера", () => {
    const packs = packs31(2500);
    const spec = E.resolveLogicSpecStack(LIVE_LOGIC_IDS, {}, E.DEFAULT_PARAMS, ALL_INDICATORS);
    const result = simulateLiveTailFinresp(E, packs, spec, E.DEFAULT_PARAMS, vol, TAIL_BARS);
    assertUnder(result.totalMs, perfLimit(4000), "live-tail full stack x31 x2500 bars");
    assertUnder(result.maxMs, perfLimit(350), "live-tail max per instrument (2500 bars)");
    assert.ok(result.perSec.length === 31, "all instruments produce perSec");
  });
});

describe("perf: runMulti / time grid (31 instruments)", () => {
  const packs = packs31(300);
  const a = 300 - TAIL_BARS;
  const b = 299;
  const spec = E.resolveLogicSpec("sma_below", {}, E.DEFAULT_PARAMS, ALL_INDICATORS);

  it("runMulti не пустой и укладывается в бюджет", () => {
    let out;
    const ms = benchSync(() => {
      out = E.runMulti(packs, spec, a, b, E.DEFAULT_PARAMS, vol, E.DEFAULT_STOPPER, {});
    });
    assert.equal(out.perSec.length, 31);
    assertUnder(ms, perfLimit(1500), "runMulti sma_below x31");
  });

  it("runPacksOnTimeGrid с портфельным cap", () => {
    const plan = E.runMultiPlan(packs, a, b);
    let synced;
    const ms = benchSync(() => {
      synced = E.runPacksOnTimeGrid(
        packs,
        plan.workUnits,
        plan.times,
        spec,
        E.DEFAULT_PARAMS,
        vol,
        { portfolioCap: E.createPortfolioCap(vol) }
      );
    });
    assert.equal(synced.perSec.length, 31);
    assertUnder(ms, perfLimit(1500), "runPacksOnTimeGrid sma_below x31");
  });
});

describe("perf: single-instrument sanity", () => {
  it("TBC на 5000 баров — нет квадратичного взрыва на одном тикере", () => {
    const candles = makeCandles("GAZP", 5000);
    const spec = E.resolveLogicSpec("TBC", {}, E.DEFAULT_PARAMS, ALL_INDICATORS);
    const a = 5000 - TAIL_BARS;
    const b = 4999;
    const ms = benchSync(() => {
      E.runOnCandles(candles, spec, a, b, E.DEFAULT_PARAMS, vol, { sec: "GAZP" });
    });
    assertUnder(ms, perfLimit(80), "runOnCandles TBC single x5000 tail window");
  });
});
