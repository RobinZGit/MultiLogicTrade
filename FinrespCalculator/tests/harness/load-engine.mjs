import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_PATH = join(__dirname, "..", "..", "MultiLogic_FinrespCalculator.engine.js");
const INDICATOR_DIR = join(__dirname, "..", "..", "indicators");
const INDICATOR_SCRIPTS = [
  "_registry.js",
  "_utils.js",
  "sma.js",
  "cma.js",
  "atr.js",
  "stoch.js",
  "linreg.js",
  "bollinger.js",
  "momentum.js",
  "vwap.js",
  "cci.js",
  "macd.js",
  "rand.js",
  join("tot", "totstoch.js")
].map((p) => join(INDICATOR_DIR, p));

/** Загрузка browser-IIFE движка в Node (без DOM). */
export function loadEngine() {
  const code = readFileSync(ENGINE_PATH, "utf8");
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.createContext(context);
  for (const p of INDICATOR_SCRIPTS) {
    const src = readFileSync(p, "utf8");
    vm.runInContext(src, context, { filename: p });
  }
  vm.runInContext(code, context, { filename: ENGINE_PATH });
  const E = context.MultiLogicFinrespEngine;
  if (!E) throw new Error("MultiLogicFinrespEngine not exported");
  return E;
}
