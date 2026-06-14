/** Множитель к порогам (медленный CI: PERF_FACTOR=3). */
export function perfFactor() {
  const raw = Number(process.env.PERF_FACTOR);
  return Number.isFinite(raw) && raw > 0 ? raw : 2.5;
}

export function perfLimit(baseMs) {
  return Math.ceil(baseMs * perfFactor());
}

/** Замер синхронной функции, возвращает ms. */
export function benchSync(fn) {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

/**
 * @param {number} ms
 * @param {number} limitMs
 * @param {string} label
 */
export function assertUnder(ms, limitMs, label) {
  if (ms > limitMs) {
    throw new Error(`${label}: ${ms.toFixed(0)} ms > limit ${limitMs} ms (factor ${perfFactor()})`);
  }
}
