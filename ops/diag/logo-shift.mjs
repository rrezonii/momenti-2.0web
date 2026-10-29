// Loads momenti.info like a visitor and records where the logo is over the first seconds,
// plus every layout shift and what caused it. Read-only.
import { chromium, devices } from "playwright";
const url = process.argv[2] || "https://momenti.info/sq";
const out = [];
const browser = await chromium.launch();
for (const [name, opts] of [["mobile (iPhone 13)", devices["iPhone 13"]], ["desktop 1440", { viewport: { width: 1440, height: 900 } }]]) {
  for (const run of [1, 2]) {
    const context = await browser.newContext(opts);
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4),
          src: (e.sources || []).map((s) => { const n = s.node; const d = n && n.nodeType === 1 ? n : n && n.parentElement;
            return (d ? (d.tagName.toLowerCase() + (d.id ? "#" + d.id : "") + (d.className && typeof d.className === "string" ? "." + d.className.trim().split(/\s+/).slice(0, 3).join(".") : "")) : "?")
              + ` ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}y ${Math.round(s.previousRect.x)}→${Math.round(s.currentRect.x)}x`; }) });
      }).observe({ type: "layout-shift", buffered: true });
      window.__logo = [];
      const t0 = performance.now();
      const tick = () => { const el = document.querySelector(".site-logo-image"); if (el) { const r = el.getBoundingClientRect();
        const k = `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
        const last = window.__logo[window.__logo.length - 1]; if (!last || last.k !== k) window.__logo.push({ t: Math.round(performance.now() - t0), k }); }
        if (performance.now() - t0 < 6000) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    if (run === 2) { await page.goto(url, { waitUntil: "load" }); }
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(5000);
    const res = await page.evaluate(() => ({ logo: window.__logo, shifts: window.__shifts.filter((s) => s.v > 0.0005) }));
    out.push(`### ${name} — ${run === 1 ? "hapja e parë" : "refresh"}`);
    out.push("Logo (koha ms → pozicioni x,y madhësia):");
    for (const p of res.logo) out.push(`  ${String(p.t).padStart(5)} ms  ${p.k}`);
    out.push(`Layout shifts (${res.shifts.length}):`);
    for (const s of res.shifts.slice(0, 15)) out.push(`  ${s.t} ms  vlera ${s.v}  ${s.src.join(" | ")}`);
    out.push("");
    if (run === 1) await page.screenshot({ path: `shot-${name.split(" ")[0]}.png` });
    await context.close();
  }
}
await browser.close();
console.log(out.join("\n"));
