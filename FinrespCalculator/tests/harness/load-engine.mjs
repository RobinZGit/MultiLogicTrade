import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_PATH = join(__dirname, "..", "..", "MultiLogic_FinrespCalculator.engine.js");

/** Загрузка browser-IIFE движка в Node (без DOM). */
export function loadEngine() {
  const code = readFileSync(ENGINE_PATH, "utf8");
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: ENGINE_PATH });
  const E = context.MultiLogicFinrespEngine;
  if (!E) throw new Error("MultiLogicFinrespEngine not exported");
  return E;
}
