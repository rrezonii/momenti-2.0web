import { randomUUID, timingSafeEqual } from "node:crypto";
import { hasSession, isRedaksiaHost, loginRedirect } from "@/lib/redaksia/session";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// Internal split calculator for the newsroom (momenti.info/calculator), behind HTTP Basic auth.
// The maths runs in the browser; saved drafts live in data/calculator/drafts.json on the server
// (the data/ folder is kept across deploys, like the KFL drafts).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR = process.env.CALCULATOR_DATA_DIR || path.join(process.cwd(), "data", "calculator");
const DRAFTS_FILE = path.join(DATA_DIR, "drafts.json");
type Draft = { id: string; period: string; a: string; b: string; savedAt: string; names?: string[]; snapshot?: Record<string, number> };
let writing: Promise<unknown> = Promise.resolve();

async function readDrafts(): Promise<Draft[]> {
  try {
    const list = JSON.parse(await readFile(DRAFTS_FILE, "utf8"));
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

// Serialise writes so two saves at the same moment cannot overwrite each other.
function updateDrafts(change: (list: Draft[]) => Draft[]) {
  const next = writing.then(async () => {
    const list = change(await readDrafts()).slice(0, 1000);
    await mkdir(DATA_DIR, { recursive: true });
    const temp = `${DRAFTS_FILE}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(list, null, 1));
    await rename(temp, DRAFTS_FILE);
    return list;
  });
  writing = next.catch(() => undefined);
  return next;
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max) : "";
}

const USER = process.env.CALCULATOR_USER?.trim() || "redaksia";
const PASS = process.env.CALCULATOR_PASSWORD?.trim() || "genti";

function same(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(request: Request) {
  if (hasSession(request)) return true; // logged in on redaksia.momenti.info
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const split = decoded.indexOf(":");
  if (split < 0) return false;
  return same(decoded.slice(0, split), USER) && same(decoded.slice(split + 1), PASS);
}

const PAGE = String.raw`<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Kalkulatori · Momenti</title>
<style>
:root{--ink:#22263a;--muted:#6b6f80;--line:#d9dbe6;--paper:#fbfaf6;--red:#9b1817;--blue:#1f3a8a;--bg:#2c0b11}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(90% 60% at 100% 0%,rgba(161,40,58,.35),transparent 65%),linear-gradient(180deg,#34101a,#2c0b11);font-family:Inter,Segoe UI,Arial,sans-serif;color:var(--ink);padding:24px 16px 48px}
.wrap{max-width:900px;margin:0 auto}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#fff4ef;margin-bottom:16px}
header h1{margin:0;font-size:22px;font-weight:900;letter-spacing:.01em}
header span{font-size:12px;color:#ffb4bb;letter-spacing:.08em;font-weight:600}
.card{background:var(--paper);border-radius:18px;box-shadow:0 18px 40px rgba(18,3,6,.35);padding:22px}
.inputs{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px}
label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
input{font:inherit;font-size:20px;font-weight:700;color:var(--ink);padding:12px 14px;border:1.5px solid var(--line);border-radius:12px;background:#fff;outline:none;width:100%;text-transform:none}
input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(31,58,138,.12)}
.sheet{margin-top:22px;background:repeating-linear-gradient(transparent 0 33px,var(--line) 33px 34px);border-radius:12px;padding:6px 6px 14px}
.title{text-align:center;font-size:24px;font-weight:800;color:var(--blue);padding:4px 0 10px;border-bottom:2px solid var(--blue)}
.total{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px 16px;padding:16px 0;font-variant-numeric:tabular-nums}
.total .sum{font-size:18px;color:var(--blue);font-weight:700;line-height:1.35;text-align:right}
.total .arrow{font-size:26px;color:var(--blue)}
.box{border:2px solid var(--blue);border-radius:12px;padding:6px 14px;font-weight:900;color:var(--blue);font-size:26px}
.cols{display:grid;grid-template-columns:repeat(3,1fr);border-top:2px solid var(--blue)}
.col{padding:12px 14px 4px;border-left:2px solid var(--blue);font-variant-numeric:tabular-nums}
.col:first-child{border-left:0}
.name{width:100%;font-size:15px;font-weight:800;color:var(--red);border:0;border-bottom:1.5px dashed transparent;background:transparent;padding:2px 0;border-radius:0;text-align:center;margin-bottom:6px}
.name:hover,.name:focus{border-bottom-color:var(--red);box-shadow:none}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:5px 0;font-size:17px;color:var(--blue);font-weight:600}
.row .op{color:var(--muted);font-weight:700;min-width:58px}
.row span,.box,.sum div{white-space:nowrap}
.row.rule{border-bottom:2px solid var(--blue)}
.row.result{font-weight:900;font-size:21px;color:var(--ink)}
.row.result .v{border:2px solid var(--blue);border-radius:10px;padding:2px 10px}
.check{margin-top:14px;font-size:13px;color:var(--muted);text-align:center}
.check b{color:var(--ink)}
.actions{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:16px;flex-wrap:wrap}
.status{margin-right:auto;font-size:13px;color:var(--muted)}
.drafts{margin-top:22px}
.drafts h2{color:#fff4ef;font-size:17px;margin:0 0 10px}
.draft{display:grid;grid-template-columns:1.3fr repeat(4,1fr) auto;gap:10px;align-items:center;background:var(--paper);border-radius:12px;padding:12px 14px;margin-bottom:8px;font-variant-numeric:tabular-nums;font-size:14px;cursor:pointer;border:2px solid transparent}
.draft:hover,.draft.is-open{border-color:#c9a2a7}
.draft b{display:block;font-size:15px}.draft .tot{font-weight:900;color:var(--blue)}.draft small{color:var(--muted)}
.draft .k{color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;display:block}
.draft button{padding:6px 10px;font-size:13px}.draft .acts{display:flex;gap:6px;justify-content:flex-end}
.empty{color:#d9c3c0;font-size:14px}
.pdf-stage{position:fixed;left:-10000px;top:0;width:794px;padding:28px 24px;background:radial-gradient(90% 60% at 100% 0%,rgba(161,40,58,.35),transparent 65%),linear-gradient(180deg,#34101a,#2c0b11)}
.pdf-stage .card{box-shadow:none}.pdf-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px}.pdf-meta b{color:#fff4ef;font-size:13px;font-weight:700}.pdf-stage .sheet{margin-top:0}
button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:10px 16px;cursor:pointer;background:#6d1b27;color:#fff}
button.ghost{background:transparent;color:var(--muted);border:1.5px solid var(--line)}
@media (max-width:720px){
  .draft{grid-template-columns:1fr 1fr}.draft>div:first-child{grid-column:1/-1}
  .inputs{grid-template-columns:1fr 1fr}.inputs label:first-child{grid-column:1/-1}
  .cols{grid-template-columns:1fr}.col{border-left:0;border-top:2px solid var(--blue)}.col:first-child{border-top:0}
}
.modal{position:fixed;inset:0;z-index:20;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 16px;background:rgba(20,4,8,.72)}
.modal.is-open{display:flex}
.modal .card{width:100%;max-width:900px}
.modal-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap}
.modal-head small{color:var(--muted)}
.modal-head div{display:flex;gap:8px}
body.modal-open{overflow:hidden}
/* Print / PDF keeps the on-screen design: dark burgundy page, header and the paper card with the sheet. */
@page{size:A4;margin:0}
@media print{
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{min-height:100%}
  body{padding:28px 24px;min-height:297mm}
  .actions,.inputs,.drafts,.modal-head{display:none!important}
  .sheet{margin-top:0}
  .card{box-shadow:none;break-inside:avoid}
  body.modal-open .wrap>.card{display:none}
  body.modal-open .modal{position:static;display:block;background:none;padding:0;overflow:visible}
}
</style>
</head>
<body>
<div class="wrap">
  <header><h1>Kalkulatori i ndarjes</h1><span><a id="portalLink" href="/" hidden style="color:#fff4ef;text-decoration:none;margin-right:14px">← Redaksia</a>MOMENTI · REDAKSIA</span></header>
  <div class="card">
    <div class="inputs">
      <label>Periudha<input id="period" placeholder="p.sh. Gusht – Shtator" autocomplete="off"></label>
      <label>Dukagjini (€)<input id="a" inputmode="decimal" placeholder="4800,91" autocomplete="off"></label>
      <label>Momenti (€)<input id="b" inputmode="decimal" placeholder="707,85" autocomplete="off"></label>
    </div>

    <div class="sheet">
      <div class="title" id="periodOut">—</div>
      <div class="total">
        <div class="sum"><div id="aOut">0,00 €</div><div id="bOut">0,00 €</div></div>
        <div class="arrow">→</div>
        <div class="box" id="totalOut">0,00 €</div>
      </div>
      <div class="cols">
        <div class="col">
          <input class="name" id="n1" value="Dukagjini" aria-label="Emri i kolonës 1">
          <div class="row"><span class="op"></span><span id="c1a">0,00 €</span></div>
          <div class="row rule"><span class="op">− 20%</span><span id="c1p">0,00 €</span></div>
          <div class="row"><span class="op"></span><span id="c1b">0,00 €</span></div>
          <div class="row rule"><span class="op">− fikse</span><span>1.000,00 €</span></div>
          <div class="row result"><span class="op"></span><span class="v" id="r1">0,00 €</span></div>
        </div>
        <div class="col">
          <input class="name" id="n2" value="Airtiketa" aria-label="Emri i kolonës 2">
          <div class="row"><span class="op"></span><span id="c2a">0,00 €</span></div>
          <div class="row rule"><span class="op">− 98%</span><span id="c2p">0,00 €</span></div>
          <div class="row result"><span class="op"></span><span class="v" id="r2">0,00 €</span></div>
        </div>
        <div class="col">
          <input class="name" id="n3" value="Momenti" aria-label="Emri i kolonës 3">
          <div class="row"><span class="op"></span><span id="c3a">0,00 €</span></div>
          <div class="row rule"><span class="op">− 2%</span><span id="c3p">0,00 €</span></div>
          <div class="row"><span class="op"></span><span id="c3b">0,00 €</span></div>
          <div class="row"><span class="op">+ 18%</span><span id="c3c">0,00 €</span></div>
          <div class="row rule"><span class="op">+ fikse</span><span>1.000,00 €</span></div>
          <div class="row result"><span class="op"></span><span class="v" id="r3">0,00 €</span></div>
        </div>
      </div>
      <div class="check" id="check"></div>
    </div>

    <div class="actions">
      <span class="status" id="status"></span>
      <button class="ghost" type="button" id="clear">E re</button>
      <button type="button" id="save">Ruaj draftin</button>
      <button type="button" id="pdfMain">Ruaj PDF</button>
    </div>
  </div>
  <div class="modal" id="modal" role="dialog" aria-modal="true" aria-label="Drafti">
    <div class="card">
      <div class="modal-head"><small id="modalWhen"></small><div>
        <button class="ghost" type="button" id="modalClose">Mbyll</button>
        <button class="ghost" type="button" id="modalEdit">Edito</button>
        <button type="button" id="pdfDraft">Ruaj PDF</button>
      </div></div>
      <div class="sheet" id="modalSheet"></div>
    </div>
  </div>
  <section class="drafts">
    <h2>Draftet e ruajtura</h2>
    <div id="draftList"><div class="empty">Duke i ngarkuar…</div></div>
  </section>
</div>
<script>
(function(){
  var $ = function(id){ return document.getElementById(id); };
  if(location.hostname.indexOf("redaksia.") === 0) $("portalLink").hidden = false;
  // Accepts 4800,91 · 4800.91 · 4.800,91 · 4,800.91 → cents (integer, no float drift).
  function cents(text){
    var s = String(text||"").replace(/[^0-9.,-]/g,"");
    if(!s) return 0;
    var lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
    var dec = Math.max(lastDot, lastComma);
    var decimals = dec >= 0 ? s.length - dec - 1 : 0;
    var multipleDots = (s.match(/\./g)||[]).length > 1;
    if (dec < 0 || (lastComma < 0 && (multipleDots || decimals === 3))) return Math.round(Number(s.replace(/[.,]/g,""))*100) || 0;
    var whole = s.slice(0, dec).replace(/[.,]/g,""), frac = (s.slice(dec+1)+"00").slice(0,2);
    return (Number(whole||0)*100 + Number(frac)) || 0;
  }
  // Same as in the notebook: percentages are cut to the cent (not rounded up).
  function pct(c, p){ return Math.floor(c * p / 100); }
  function fmt(c){
    var neg = c < 0; c = Math.abs(c);
    var e = Math.floor(c/100).toString().replace(/\B(?=(\d{3})+(?!\d))/g,".");
    return (neg?"− ":"") + e + "," + String(c%100).padStart(2,"0") + " €";
  }
  function set(id, c){ $(id).textContent = fmt(c); }
  var FIXED = 100000;
  function compute(a, b){
    var t = a + b, a80 = pct(a, 80), t2 = pct(t, 2), b98 = pct(b, 98), a18 = pct(a, 18);
    return { a:a, b:b, t:t, c1p:a - a80, a80:a80, r1:a80 - FIXED, c2p:t - t2, r2:t2, c3p:b - b98, b98:b98, a18:a18, r3:b98 + a18 + FIXED };
  }
  function sheetHtml(period, names, v){
    function row(op, val, cls){ return '<div class="row' + (cls ? ' ' + cls : '') + '"><span class="op">' + op + '</span><span>' + fmt(val) + '</span></div>'; }
    function res(val){ return '<div class="row result"><span class="op"></span><span class="v">' + fmt(val) + '</span></div>'; }
    function name(n){ return '<div class="name" style="border:0">' + esc(n) + '</div>'; }
    var sum = v.r1 + v.r2 + v.r3;
    return '<div class="title">' + esc(period || "—") + '</div>'
      + '<div class="total"><div class="sum"><div>' + fmt(v.a) + '</div><div>' + fmt(v.b) + '</div></div><div class="arrow">→</div><div class="box">' + fmt(v.t) + '</div></div>'
      + '<div class="cols">'
      + '<div class="col">' + name(names[0]) + row("", v.a) + row("− 20%", v.c1p, "rule") + row("", v.a80) + row("− fikse", FIXED, "rule") + res(v.r1) + '</div>'
      + '<div class="col">' + name(names[1]) + row("", v.t) + row("− 98%", v.c2p, "rule") + res(v.r2) + '</div>'
      + '<div class="col">' + name(names[2]) + row("", v.b) + row("− 2%", v.c3p, "rule") + row("", v.b98) + row("+ 18%", v.a18) + row("+ fikse", FIXED, "rule") + res(v.r3) + '</div>'
      + '</div><div class="check">Kontroll: ' + fmt(v.r1) + ' + ' + fmt(v.r2) + ' + ' + fmt(v.r3) + ' = <b>' + fmt(sum) + '</b> (totali ' + fmt(v.t) + (sum === v.t ? '' : ', diferenca nga rrumbullakimi ' + fmt(v.t - sum)) + ')</div>';
  }
  function render(){
    var a = cents($("a").value), b = cents($("b").value), t = a + b;
    $("periodOut").textContent = $("period").value.trim() || "—";
    set("aOut", a); set("bOut", b); set("totalOut", t);
    var a80 = pct(a, 80);
    set("c1a", a); set("c1p", a - a80); set("c1b", a80); var r1 = a80 - FIXED; set("r1", r1);
    var t2 = pct(t, 2);
    set("c2a", t); set("c2p", t - t2); set("r2", t2);
    var b98 = pct(b, 98), a18 = pct(a, 18);
    set("c3a", b); set("c3p", b - b98); set("c3b", b98); set("c3c", a18); var r3 = b98 + a18 + FIXED; set("r3", r3);
    var sum = r1 + t2 + r3;
    $("check").innerHTML = a || b ? "Kontroll: " + fmt(r1) + " + " + fmt(t2) + " + " + fmt(r3) + " = <b>" + fmt(sum) + "</b> (totali " + fmt(t) + (sum === t ? "" : ", diferenca nga rrumbullakimi " + fmt(t - sum)) + ")" : "";
    try { localStorage.setItem("momenti-calc-v2", JSON.stringify({ n1:$("n1").value, n2:$("n2").value, n3:$("n3").value })); } catch(e){}
  }
  try { var saved = JSON.parse(localStorage.getItem("momenti-calc-v2")||"null"); if(saved){ ["n1","n2","n3"].forEach(function(k){ if(saved[k]) $(k).value = saved[k]; }); } } catch(e){}
  ["period","a","b","n1","n2","n3"].forEach(function(id){ $(id).addEventListener("input", render); });
  var current = null, drafts = [];
  function status(t){ $("status").textContent = t; }
  function esc(t){ return String(t).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function results(d){ var a = cents(d.a), b = cents(d.b); return [pct(a,80) - FIXED, pct(a+b,2), pct(b,98) + pct(a,18) + FIXED]; }
  function showDrafts(){
    if(!drafts.length){ $("draftList").innerHTML = '<div class="empty">Ende nuk ka drafte. Shkruaj vlerat dhe shtyp “Ruaj draftin”.</div>'; return; }
    $("draftList").innerHTML = drafts.map(function(d){
      var r = results(d), when = new Date(d.savedAt);
      return '<div class="draft' + (d.id === current ? ' is-open' : '') + '" data-id="' + esc(d.id) + '">'
        + '<div><b>' + esc(d.period || "Pa periudhë") + '</b><small>' + [when.getDate(), when.getMonth()+1].map(function(x){ return String(x).padStart(2,"0"); }).join(".") + "." + when.getFullYear() + " · " + String(when.getHours()).padStart(2,"0") + ":" + String(when.getMinutes()).padStart(2,"0") + '</small></div>'
        + '<div><span class="k">' + esc($("n1").value) + '</span>' + fmt(r[0]) + '</div>'
        + '<div><span class="k">' + esc($("n2").value) + '</span>' + fmt(r[1]) + '</div>'
        + '<div><span class="k">' + esc($("n3").value) + '</span>' + fmt(r[2]) + '</div>'
        + '<div class="tot"><span class="k">Totali</span>' + fmt(cents(d.a) + cents(d.b)) + '</div>'
        + '<div class="acts"><button class="ghost" type="button" data-edit="' + esc(d.id) + '">Edito</button><button class="ghost" type="button" data-del="' + esc(d.id) + '">Fshi</button></div></div>';
    }).join("");
  }
  function load(){
    fetch("/calculator?drafts=1", { credentials: "same-origin", cache: "no-store" })
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(list){ drafts = list; showDrafts(); })
      .catch(function(){ $("draftList").innerHTML = '<div class="empty">Draftet nuk u ngarkuan. Rifresko faqen.</div>'; });
  }
  $("save").addEventListener("click", function(){
    if(!cents($("a").value) && !cents($("b").value)){ status("Shkruaj vlerat para se ta ruash."); return; }
    status("Duke ruajtur…");
    fetch("/calculator", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current, period: $("period").value, a: $("a").value, b: $("b").value,
        names: [$("n1").value, $("n2").value, $("n3").value], snapshot: compute(cents($("a").value), cents($("b").value)) }) })
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(res){ current = res.id; drafts = res.drafts; showDrafts(); status("U ruajt ✓"); })
      .catch(function(){ status("Ruajtja dështoi. Provo përsëri."); });
  });
  $("draftList").addEventListener("click", function(e){
    var edit = e.target.closest("[data-edit]");
    if(edit){
      var de = drafts.find(function(x){ return x.id === edit.getAttribute("data-edit"); }); if(!de) return;
      editDraft(de); return;
    }
    var del = e.target.closest("[data-del]");
    if(del){
      e.stopPropagation();
      if(!confirm("Ta fshij këtë draft?")) return;
      fetch("/calculator?id=" + encodeURIComponent(del.getAttribute("data-del")), { method: "DELETE", credentials: "same-origin" })
        .then(function(r){ if(!r.ok) throw 0; return r.json(); })
        .then(function(res){ if(current === del.getAttribute("data-del")) current = null; drafts = res.drafts; showDrafts(); status("U fshi."); })
        .catch(function(){ status("Fshirja dështoi."); });
      return;
    }
    var row = e.target.closest(".draft"); if(!row) return;
    var d = drafts.find(function(x){ return x.id === row.getAttribute("data-id"); }); if(!d) return;
    openDraft(d);
  });
  var opened = null;
  function openDraft(d){
    opened = d;
    var snap = d.snapshot && typeof d.snapshot.t === "number" ? d.snapshot : compute(cents(d.a), cents(d.b));
    var names = d.names && d.names.length === 3 ? d.names : [$("n1").value, $("n2").value, $("n3").value];
    var when = new Date(d.savedAt);
    $("modalWhen").textContent = "Ruajtur më " + [when.getDate(), when.getMonth()+1].map(function(x){ return String(x).padStart(2,"0"); }).join(".") + "." + when.getFullYear() + " · " + String(when.getHours()).padStart(2,"0") + ":" + String(when.getMinutes()).padStart(2,"0");
    $("modalSheet").innerHTML = sheetHtml(d.period, names, snap);
    $("modal").classList.add("is-open"); document.body.classList.add("modal-open");
  }
  function closeDraft(){ $("modal").classList.remove("is-open"); document.body.classList.remove("modal-open"); opened = null; }
  $("modalClose").addEventListener("click", closeDraft);
  $("modal").addEventListener("click", function(e){ if(e.target === $("modal")) closeDraft(); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && opened) closeDraft(); });
  function editDraft(d){
    current = d.id; $("period").value = d.period; $("a").value = d.a; $("b").value = d.b; render(); showDrafts();
    status("Po e editon draftin. “Ruaj draftin” e ruan mbi të njëjtin."); window.scrollTo({ top: 0, behavior: "smooth" }); $("a").focus({ preventScroll: true });
  }
  $("modalEdit").addEventListener("click", function(){
    var d = opened; if(!d) return; closeDraft(); editDraft(d); return;
    current = d.id; $("period").value = d.period; $("a").value = d.a; $("b").value = d.b; render(); showDrafts();
    status("Po e editon draftin. “Ruaj draftin” e ruan mbi të njëjtin."); window.scrollTo({ top: 0, behavior: "smooth" });
  });
  // "Ruaj PDF": draws the header + sheet on the dark page (same design as on screen) and downloads an A4 PDF.
  function loadScript(src){ return new Promise(function(ok, fail){ var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); }); }
  var libs = null;
  function pdfLibs(){
    return libs || (libs = Promise.all([
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"),
    ]).catch(function(e){ libs = null; throw e; }));
  }
  function stamp(date){
    var p2 = function(x){ return String(x).padStart(2,"0"); };
    return p2(date.getDate()) + "." + p2(date.getMonth()+1) + "." + date.getFullYear() + " · " + p2(date.getHours()) + ":" + p2(date.getMinutes());
  }
  function savePdf(period, sheetInner, button, created){
    var label = button.textContent; button.disabled = true; button.textContent = "Duke krijuar…";
    var stage = document.createElement("div"); stage.className = "pdf-stage";
    stage.innerHTML = '<header><h1>Kalkulatori i ndarjes</h1><div class="pdf-meta"><span>MOMENTI · REDAKSIA</span><b>Krijuar më ' + stamp(new Date()) + '</b></div></header><div class="card"><div class="sheet">' + sheetInner + '</div></div>';
    stage.querySelectorAll("input.name").forEach(function(input, i){ var d = document.createElement("div"); d.className = "name"; d.style.border = "0"; d.textContent = $("n" + (i + 1)).value; input.replaceWith(d); });
    document.body.appendChild(stage);
    pdfLibs().then(function(){ return document.fonts ? document.fonts.ready : null; })
      .then(function(){ return window.html2canvas(stage, { scale: 2, backgroundColor: "#2c0b11" }); })
      .then(function(canvas){
        var pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        var w = 210, h = canvas.height * w / canvas.width;
        pdf.setFillColor(44, 11, 17); pdf.rect(0, 0, 210, 297, "F");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, Math.min(h, 297));
        var name = (period || "kalkulimi").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "kalkulimi";
        pdf.save("Momenti-" + name + ".pdf");
        status("PDF u ruajt ✓");
      })
      .catch(function(){ status("PDF nuk u krijua. Kontrollo internetin dhe provo përsëri."); })
      .then(function(){ stage.remove(); button.disabled = false; button.textContent = label; });
  }
  $("pdfMain").addEventListener("click", function(){ var d = drafts.find(function(x){ return x.id === current; }); savePdf($("period").value, document.querySelector(".wrap > .card .sheet").innerHTML, this, d ? new Date(d.savedAt) : null); });
  $("pdfDraft").addEventListener("click", function(){ savePdf(opened ? opened.period : "", $("modalSheet").innerHTML, this, opened ? new Date(opened.savedAt) : null); });
  $("clear").addEventListener("click", function(){ current = null; $("a").value = ""; $("b").value = ""; $("period").value = ""; render(); showDrafts(); status(""); $("period").focus(); });
  ["n1","n2","n3"].forEach(function(id){ $(id).addEventListener("input", showDrafts); });
  render(); load();
})();
</script>
</body>
</html>`;

function denied(request: Request) {
  if (isRedaksiaHost(request)) return portalDenied(request);
  return new Response("Kërkohet hyrja.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Momenti Kalkulatori", charset="UTF-8"', "Cache-Control": "no-store" },
  });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin || new URL(origin).host === request.headers.get("host");
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });

export async function POST(request: Request) {
  if (!authorized(request)) return denied(request);
  if (!sameOrigin(request)) return json({ error: "Kërkesë e pavlefshme." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Të dhëna të pavlefshme." }, 400);
  const names = Array.isArray(body.names) ? body.names.slice(0, 3).map((name) => clean(name, 40)) : undefined;
  // The exact numbers as shown when saved, so an opened draft looks the same even if the formulas change later.
  const snapshot: Record<string, number> = {};
  if (body.snapshot && typeof body.snapshot === "object") {
    for (const [key, value] of Object.entries(body.snapshot as Record<string, unknown>).slice(0, 30)) {
      if (/^[a-z0-9]{1,8}$/i.test(key) && typeof value === "number" && Number.isSafeInteger(value)) snapshot[key] = value;
    }
  }
  const draft: Draft = {
    id: clean(body.id, 64) || randomUUID(),
    period: clean(body.period, 80), a: clean(body.a, 32), b: clean(body.b, 32),
    savedAt: new Date().toISOString(), names, snapshot,
  };
  const drafts = await updateDrafts((list) => [draft, ...list.filter((item) => item.id !== draft.id)]);
  return json({ id: draft.id, drafts });
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return denied(request);
  if (!sameOrigin(request)) return json({ error: "Kërkesë e pavlefshme." }, 403);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const drafts = await updateDrafts((list) => list.filter((item) => item.id !== id));
  return json({ drafts });
}

export async function GET(request: Request) {
  if (!authorized(request)) return denied(request);
  if (new URL(request.url).searchParams.has("drafts")) return json(await readDrafts());
  if (!authorized(request)) {
    return new Response("Kërkohet hyrja.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Momenti Kalkulatori", charset="UTF-8"',
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  return new Response(PAGE, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// On redaksia.momenti.info: pages go to the login screen; data requests just get 401.
function portalDenied(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (request.method === "GET" && accept.includes("text/html")) return loginRedirect(request);
  return Response.json({ error: "Sesioni ka përfunduar. Hyr përsëri." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
