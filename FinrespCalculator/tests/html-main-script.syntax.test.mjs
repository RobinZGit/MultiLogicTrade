import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "..", "MultiLogic_FinrespCalculator.html");
const MAIN_SCRIPT_MARKER = "<script>\n/*\n * UI и оркестрация";

/** Извлечь inline-скрипт оркестрации из HTML (тот же блок, что грузится в браузере). */
function extractMainOrchestrationScript(html) {
  const start = html.indexOf(MAIN_SCRIPT_MARKER);
  assert.ok(start >= 0, "main orchestration script marker not found in HTML");
  const scriptStart = start + "<script>".length;
  const scriptEnd = html.indexOf("</script>", scriptStart);
  assert.ok(scriptEnd >= 0, "main orchestration script closing tag not found");
  return html.slice(scriptStart, scriptEnd);
}

test("MultiLogic_FinrespCalculator.html — inline main script has valid JavaScript syntax", () => {
  const html = fs.readFileSync(htmlPath, "utf8");
  const src = extractMainOrchestrationScript(html);
  const tmp = path.join(__dirname, ".tmp-main-script-syntax-check.js");
  fs.writeFileSync(tmp, src, "utf8");
  try {
    execFileSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
  } finally {
    fs.unlinkSync(tmp);
  }
});
