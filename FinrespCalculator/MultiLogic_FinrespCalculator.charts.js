/**
 * Интерактивные графики по инструментам: свечи OHLC, pan/zoom, индикаторы, входы/выходы.
 */
(function (root) {
  "use strict";

  const PRICE_KEYS = [
    "high", "low", "open", "close",
    "sma", "smaUpper", "smaLower",
    "linregUp", "linregDn", "linregMid",
    "bollingerUp", "bollingerDn", "bollingerMid",
    "vwap"
  ];

  const IND_LINE = [
    { key: "sma", stroke: "#d97706", width: 1, dash: "5 4", opacity: 0.85, label: "SMA — скользящая средняя" },
    { key: "smaUpper", stroke: "#f59e0b", width: 0.9, dash: "2 4", opacity: 0.75, label: "SMA — верх коридора (±K×ATR)" },
    { key: "smaLower", stroke: "#f59e0b", width: 0.9, dash: "2 4", opacity: 0.75, label: "SMA — низ коридора (±K×ATR)" },
    { key: "linregMid", stroke: "#7c3aed", width: 1, dash: null, opacity: 0.7, label: "LinReg — линия регрессии (центр)" },
    { key: "linregUp", stroke: "#a78bfa", width: 0.9, dash: "3 3", opacity: 0.65, label: "LinReg — верхняя полоса" },
    { key: "linregDn", stroke: "#a78bfa", width: 0.9, dash: "3 3", opacity: 0.65, label: "LinReg — нижняя полоса" },
    { key: "bollingerMid", stroke: "#0891b2", width: 0.9, dash: null, opacity: 0.65, label: "Bollinger — средняя (SMA)" },
    { key: "bollingerUp", stroke: "#67e8f9", width: 0.8, dash: "2 3", opacity: 0.7, label: "Bollinger — верхняя полоса" },
    { key: "bollingerDn", stroke: "#67e8f9", width: 0.8, dash: "2 3", opacity: 0.7, label: "Bollinger — нижняя полоса" },
    { key: "vwap", stroke: "#16a34a", width: 1, dash: "7 3", opacity: 0.7, label: "VWAP — средневзвешенная цена" }
  ];

  const LONG_MARKER = { entry: "#16a34a", exit: "#15803d" };
  const SHORT_MARKER = { entry: "#dc2626", exit: "#b91c1c" };

  const SIGNAL_HINT = {
    op_long: "Op long",
    op_short: "Op short",
    cl_long: "Cl long",
    cl_short: "Cl short",
    flip_to_short: "Flip → short (Op)",
    flip_to_long: "Flip → long (Op)",
    sl: "Stop-loss",
    tp: "Take-profit",
    sma_long: "SMA → long",
    sma_short: "SMA → short",
    sma_flat: "SMA → flat",
    logic: "Cl / сигнал логики"
  };

  function markerColors(side) {
    return side === "short" ? SHORT_MARKER : LONG_MARKER;
  }

  function tradeMarkerTitle(kind, side, r) {
    const sideRu = side === "short" ? "short" : "long";
    const prefix = kind === "in" ? "Вход" : "Выход";
    const logic = kind === "in" ? r.tradeInLogic : r.tradeOutLogic;
    const signal = kind === "in" ? r.tradeInSignal : r.tradeOutSignal;
    const parts = [`${prefix} ${sideRu}`];
    if (logic) parts.push(String(logic));
    if (signal) {
      const hint = SIGNAL_HINT[signal] || signal;
      if (hint) parts.push(hint);
    }
    return esc(parts.join(" · "));
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function rowHasKey(rows, key) {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.[key] != null) return true;
    }
    return false;
  }

  function legendLineSample(spec) {
    const dash = spec.dash ? ` stroke-dasharray="${spec.dash}"` : "";
    const sw = Math.max(1.6, (spec.width || 1) * 1.5);
    return `<svg class="ml-chart-legend-swatch" width="32" height="10" aria-hidden="true"><line x1="0" y1="5" x2="32" y2="5" stroke="${spec.stroke}" stroke-width="${sw}"${dash} opacity="${spec.opacity ?? 1}"/></svg>`;
  }

  /** Легенда линий индикаторов под графиком (только присутствующие в данных). */
  function buildIndicatorLegend(rows) {
    const active = IND_LINE.filter((spec) => rowHasKey(rows, spec.key));
    if (!active.length) return "";
    const items = active.map((spec) =>
      `<span class="ml-chart-legend-item">${legendLineSample(spec)}<span>${esc(spec.label)}</span></span>`).join("");
    return `<div class="ml-chart-ind-legend" role="list">${items}</div>`;
  }

  /** Копирование текущего SVG-графика в буфер как PNG. */
  async function copyChartToClipboard(viewport) {
    const svg = viewport?.querySelector?.("svg.ml-chart-svg");
    if (!svg) return { ok: false, reason: "no-svg" };
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      return { ok: false, reason: "clipboard" };
    }
    const vb = svg.viewBox.baseVal;
    const w = vb.width || 820;
    const h = vb.height || 340;
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return { ok: false, reason: "canvas" };
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!pngBlob) return { ok: false, reason: "png" };
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      return { ok: true };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function wireCopyButton(btn, viewport) {
    if (!btn || !viewport) return;
    const defaultLabel = btn.textContent || "Копировать график";
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      btn.disabled = true;
      const result = await copyChartToClipboard(viewport);
      btn.disabled = false;
      if (result.ok) {
        btn.textContent = "Скопировано";
        btn.classList.add("ml-chart-copy-btn--ok");
        setTimeout(() => {
          btn.textContent = defaultLabel;
          btn.classList.remove("ml-chart-copy-btn--ok");
        }, 1800);
        return;
      }
      btn.textContent = result.reason === "clipboard" ? "Буфер недоступен" : "Ошибка копирования";
      btn.classList.add("ml-chart-copy-btn--err");
      setTimeout(() => {
        btn.textContent = defaultLabel;
        btn.classList.remove("ml-chart-copy-btn--err");
      }, 2200);
    });
  }

  function buildModeBands(rows, modeRegions, x, top, bottom) {
    if (!modeRegions?.length) return "";
    return modeRegions.map(({ fromIdx, toIdx, mode }) => {
      const x0 = x(fromIdx);
      const x1 = x(toIdx);
      const fill = mode === "sandbox" ? "#ecfdf5" : "#fef2f2";
      const stroke = mode === "sandbox" ? "#bbf7d0" : "#fecaca";
      const w = Math.max(2, x1 - x0 + (toIdx === rows.length - 1 ? 4 : 0));
      const title = mode === "sandbox" ? "Песочница (фейк)" : "Реальная торговля";
      return `<g opacity="0.88"><rect x="${x0.toFixed(1)}" y="${top}" width="${w.toFixed(1)}" height="${bottom - top}" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/><title>${title}</title></g>`;
    }).join("");
  }

  function buildStopVLines(vLines, x, top, bottom) {
    return (vLines || []).map(({ idx, kind, scope, label }) => {
      const xi = x(idx).toFixed(1);
      if (kind === "config") {
        const tip = esc(label || "изменение параметров");
        return `<g opacity="0.9"><line x1="${xi}" y1="${top}" x2="${xi}" y2="${bottom}" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="6 4"/><title>${tip}</title></g>`;
      }
      if (kind === "order-buy" || kind === "order-sell") {
        const stroke = kind === "order-buy" ? "#2563eb" : "#c2410c";
        const tip = esc(label || (kind === "order-buy" ? "Покупка" : "Продажа"));
        return `<g opacity="0.92"><line x1="${xi}" y1="${top}" x2="${xi}" y2="${bottom}" stroke="${stroke}" stroke-width="1.8" stroke-dasharray="3 3"/><title>${tip}</title></g>`;
      }
      const stroke = kind === "tp" ? "#16a34a" : "#dc2626";
      const dash = scope === "portfolio" ? "7 4" : "4 3";
      const width = scope === "portfolio" ? 2 : 1.3;
      const op = scope === "portfolio" ? 0.9 : 0.75;
      return `<line x1="${xi}" y1="${top}" x2="${xi}" y2="${bottom}" stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${dash}" opacity="${op}"/>`;
    }).join("");
  }

  function tradeMarkerSvg(r, i, x, y, hi, lo) {
    const parts = [];
    const cx = x(i);
    const span = Math.max((hi - lo) * 0.012, 0.02);
    const triH = Math.max(span * 2.2, (hi - lo) * 0.018);
    const triW = triH * 0.85;
    const highY = y(r.high ?? r.close ?? 0);

    if (r.tradeIn === "long" || r.tradeIn === "short") {
      const tipY = highY - triH - 2;
      const baseY = tipY + triH;
      const pts = `${cx.toFixed(1)},${tipY.toFixed(1)} ${(cx - triW).toFixed(1)},${baseY.toFixed(1)} ${(cx + triW).toFixed(1)},${baseY.toFixed(1)}`;
      const colors = markerColors(r.tradeIn);
      const title = tradeMarkerTitle("in", r.tradeIn, r);
      parts.push(`<polygon points="${pts}" fill="none" stroke="${colors.entry}" stroke-width="1.4" opacity="0.95"><title>${title}</title></polygon>`);
    }

    if (r.tradeOut) {
      const side = r.tradeOutSide || r.tradeIn || "long";
      const colors = markerColors(side);
      const title = tradeMarkerTitle("out", side, r);
      const baseY = highY - 3;
      const tipY = baseY - triH;
      const pts = `${cx.toFixed(1)},${tipY.toFixed(1)} ${(cx - triW).toFixed(1)},${baseY.toFixed(1)} ${(cx + triW).toFixed(1)},${baseY.toFixed(1)}`;
      parts.push(`<polygon points="${pts}" fill="${colors.exit}" stroke="${colors.exit}" stroke-width="0.6" opacity="0.95"><title>${title}</title></polygon>`);
    }

    return parts.join("");
  }

  function renderChartSvg(rows, view, options) {
    const {
      finresp = 0,
      title = "График",
      compact = false,
      decor = {},
      format = {}
    } = options || {};
    const axisPrice = format.axisPrice || ((v) => String(v));
    const axisTime = format.axisTime || ((t) => String(t ?? ""));
    const fmtFin = format.fmtFinresp || ((v) => String(v));

    if (!rows?.length) return "";

    const v0 = clamp(Math.floor(view.start), 0, rows.length - 1);
    const v1 = clamp(Math.ceil(view.end), v0, rows.length - 1);
    const visN = v1 - v0 + 1;

    const w = 820;
    const h = compact ? 210 : 340;
    const left = 68;
    const right = 28;
    const top = compact ? 24 : 28;
    const bottom = 58;
    const plotW = w - left - right;
    const plotH = h - top - bottom;

    const slice = rows.slice(v0, v1 + 1);
    let vals = slice.flatMap((r) => PRICE_KEYS.map((k) => r?.[k]).filter((v) => v != null));
    if (!vals.length) return "";
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.06, 0.01);
    const lo = min - pad;
    const hi = max + pad;

    const x = (i) => left + (i - v0) * plotW / Math.max(1, visN - 1);
    const y = (v) => top + (hi - v) * plotH / (hi - lo);

    const niceTicks = format.niceTicks || ((a, b) => [a, b]);
    const yTicks = niceTicks(lo, hi, 5);
    const xTickCount = Math.min(6, Math.max(2, Math.floor(visN / 12)));
    const xTickIdx = Array.from({ length: xTickCount }, (_, k) =>
      v0 + Math.round(k * (visN - 1) / Math.max(1, xTickCount - 1)));

    const candleW = Math.max(1.2, Math.min(14, plotW / Math.max(visN, 1) * 0.62));
    const candles = slice.map((r, j) => {
      const i = v0 + j;
      if (r?.open == null && r?.close == null) return "";
      const o = r.open ?? r.close;
      const c = r.close ?? r.open;
      const hiP = r.high ?? Math.max(o, c);
      const loP = r.low ?? Math.min(o, c);
      const cx = x(i);
      const up = c >= o;
      const bodyCol = up ? "#16a34a" : "#dc2626";
      const yHi = y(hiP);
      const yLo = y(loP);
      const yO = y(o);
      const yC = y(c);
      const bodyTop = Math.min(yO, yC);
      const bodyH = Math.max(1, Math.abs(yC - yO));
      return `<g opacity="0.92">
<line x1="${cx.toFixed(1)}" y1="${yHi.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${yLo.toFixed(1)}" stroke="${bodyCol}" stroke-width="1"/>
<rect x="${(cx - candleW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${candleW.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="${bodyCol}" stroke="${bodyCol}" stroke-width="0.5"/>
</g>`;
    }).join("");

    const indLines = IND_LINE.filter((spec) => rowHasKey(slice, spec.key)).map((spec) => {
      const pts = slice.map((r, j) => {
        const v = r?.[spec.key];
        if (v == null) return null;
        return `${x(v0 + j).toFixed(1)},${y(v).toFixed(1)}`;
      }).filter(Boolean).join(" ");
      if (!pts) return "";
      const dash = spec.dash ? ` stroke-dasharray="${spec.dash}"` : "";
      return `<polyline fill="none" stroke="${spec.stroke}" stroke-width="${spec.width}"${dash} opacity="${spec.opacity}" points="${pts}"/>`;
    }).join("");

    const markers = slice.map((r, j) => tradeMarkerSvg(r, v0 + j, x, y, hi, lo)).join("");

    const stopLines = decor.vLines?.length ? decor.vLines : [];
    const stopLinesSvg = buildStopVLines(stopLines, x, top, h - bottom);
    const modeBands = buildModeBands(rows, decor.modeRegions, x, top, h - bottom);

    const gridH = yTicks.map((v) =>
      `<line x1="${left}" y1="${y(v).toFixed(1)}" x2="${w - right}" y2="${y(v).toFixed(1)}" stroke="#e8edf4" stroke-width="1"/>`).join("");
    const gridV = xTickIdx.map((i) =>
      `<line x1="${x(i).toFixed(1)}" y1="${top}" x2="${x(i).toFixed(1)}" y2="${h - bottom}" stroke="#e8edf4" stroke-width="1"/>`).join("");
    const yLabels = yTicks.map((v) =>
      `<text x="${left - 8}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#64748b" font-family="Consolas,monospace">${axisPrice(v)}</text>`).join("");
    const xLabels = xTickIdx.map((i) =>
      `<text x="${x(i).toFixed(1)}" y="${h - 10}" text-anchor="middle" font-size="9" fill="#64748b" font-family="Consolas,monospace">${axisTime(rows[i]?.time)}</text>`).join("");

    const color = finresp < 0 ? "#b91c1c" : "#047857";
    const stopLegend = stopLines.length ? " · SL/TP поз. — тонкая · портф. — жирная" : "";
    const modeLegend = decor.modeRegions?.length
      ? " · зелёная область — песочница · розовая — реальная торговля"
      : "";
    const zoomHint = visN < rows.length
      ? ` · видно ${visN} из ${rows.length} баров`
      : "";

    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" class="ml-chart-svg">
<rect width="${w}" height="${h}" fill="#fff"/>
${modeBands}
${gridH}${gridV}
${stopLinesSvg}
<line x1="${left}" y1="${top}" x2="${left}" y2="${h - bottom}" stroke="#94a3b8" stroke-width="1.2"/>
<line x1="${left}" y1="${h - bottom}" x2="${w - right}" y2="${h - bottom}" stroke="#94a3b8" stroke-width="1.2"/>
${yLabels}${xLabels}
<text x="${left - 10}" y="${top - 8}" text-anchor="end" font-size="10" fill="#475569" font-weight="600">Цена, ₽</text>
<text x="${(left + w - right) / 2}" y="${h - 1}" text-anchor="middle" font-size="10" fill="#475569" font-weight="600">Время</text>
${indLines}
${candles}
${markers}
<text x="${w - right - 4}" y="${top + 12}" text-anchor="end" fill="${color}" font-size="${compact ? 12 : 14}" font-weight="700" font-family="Consolas,monospace">FINRESP ${fmtFin(finresp)} ₽</text>
<text x="${left + 4}" y="${top + 12}" font-size="9" fill="#64748b">△↓ вход · ▲ выход · long — зелёный · short — красный · наведение — логика/сигнал · колёсико — масштаб · drag — сдвиг${stopLegend}${modeLegend}${zoomHint}</text>
</svg>`;
  }

  /**
   * @param {HTMLElement} host
   * @param {object} options rows, finresp, title, compact, decor, format
   */
  function mount(host, options) {
    if (!host) return null;
    const rows = options?.rows || [];
    if (!rows.length) {
      host.innerHTML = "";
      return null;
    }

    const minBars = 6;
    let view = { start: 0, end: rows.length - 1 };
    let drag = null;

    host.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "ml-instrument-chart";

    let copyBtn = null;
    if (options?.secTitle) {
      const header = document.createElement("div");
      header.className = "chart-mini-header";
      const titleEl = document.createElement("p");
      titleEl.className = "chart-sec-title";
      titleEl.textContent = options.secTitle;
      copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "ml-chart-copy-btn";
      copyBtn.textContent = "Копировать график";
      copyBtn.title = "Скопировать видимый график в буфер обмена (PNG)";
      header.appendChild(titleEl);
      header.appendChild(copyBtn);
      wrap.appendChild(header);
    }

    const viewport = document.createElement("div");
    viewport.className = "ml-chart-viewport";
    viewport.title = "Колёсико — масштаб, перетаскивание — сдвиг по времени";

    const legendHost = document.createElement("div");
    legendHost.className = "ml-chart-legend-host";

    function render() {
      view.start = clamp(view.start, 0, rows.length - 1);
      view.end = clamp(view.end, view.start, rows.length - 1);
      if (view.end - view.start + 1 < minBars) {
        view.end = Math.min(rows.length - 1, view.start + minBars - 1);
      }
      viewport.innerHTML = renderChartSvg(rows, view, options);
      legendHost.innerHTML = buildIndicatorLegend(rows);
    }

    if (copyBtn) wireCopyButton(copyBtn, viewport);

    function panByBars(delta) {
      const span = view.end - view.start;
      let ns = view.start + delta;
      let ne = view.end + delta;
      if (ns < 0) {
        ne -= ns;
        ns = 0;
      }
      if (ne > rows.length - 1) {
        ns -= ne - (rows.length - 1);
        ne = rows.length - 1;
      }
      ns = clamp(ns, 0, rows.length - 1);
      ne = clamp(ne, ns, rows.length - 1);
      if (ne - ns + 1 < minBars) ne = Math.min(rows.length - 1, ns + minBars - 1);
      view.start = ns;
      view.end = ne;
      render();
    }

    viewport.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const frac = clamp((ev.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
      const span = view.end - view.start;
      const factor = ev.deltaY < 0 ? 0.82 : 1.22;
      let newSpan = Math.round(span * factor);
      newSpan = clamp(newSpan, minBars - 1, rows.length - 1);
      const anchor = view.start + span * frac;
      let ns = Math.round(anchor - newSpan * frac);
      let ne = ns + newSpan;
      if (ns < 0) {
        ne -= ns;
        ns = 0;
      }
      if (ne > rows.length - 1) {
        ns -= ne - (rows.length - 1);
        ne = rows.length - 1;
      }
      view.start = clamp(ns, 0, rows.length - 1);
      view.end = clamp(ne, view.start, rows.length - 1);
      render();
    }, { passive: false });

    viewport.addEventListener("mousedown", (ev) => {
      if (ev.button !== 0) return;
      drag = { x0: ev.clientX, start0: view.start, end0: view.end };
      viewport.classList.add("ml-chart-dragging");
      ev.preventDefault();
    });

    const onMove = (ev) => {
      if (!drag) return;
      const rect = viewport.getBoundingClientRect();
      const span = drag.end0 - drag.start0;
      const barsPerPx = span / Math.max(rect.width, 1);
      const delta = Math.round(-(ev.clientX - drag.x0) * barsPerPx);
      view.start = drag.start0 + delta;
      view.end = drag.end0 + delta;
      render();
    };

    const onUp = () => {
      if (!drag) return;
      drag = null;
      viewport.classList.remove("ml-chart-dragging");
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    viewport.addEventListener("dblclick", () => {
      view = { start: 0, end: rows.length - 1 };
      render();
    });

    wrap.appendChild(viewport);
    wrap.appendChild(legendHost);
    host.appendChild(wrap);
    render();

    return {
      resetView() {
        view = { start: 0, end: rows.length - 1 };
        render();
      },
      panByBars,
      copyToClipboard() {
        return copyChartToClipboard(viewport);
      },
      destroy() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        host.innerHTML = "";
      }
    };
  }

  root.MLInstrumentChart = { mount, renderChartSvg, buildIndicatorLegend, copyChartToClipboard };
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
