import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { LOGO, STAMP } from "@/lib/invoices/assets";

// Momenti Media invoices (momenti.info/faturat), behind HTTP Basic auth.
// Invoices are stored in data/invoices/invoices.json (data/ survives deploys). The invoice
// number is always assigned here on the server, in order, per year: #07/2026, #08/2026, …
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USER = process.env.INVOICES_USER?.trim() || process.env.CALCULATOR_USER?.trim() || "redaksia";
const PASS = process.env.INVOICES_PASSWORD?.trim() || process.env.CALCULATOR_PASSWORD?.trim() || "genti";
// Last invoice number made before this page existed (#06/2026), so the first one here is #07/2026.
const START: Record<number, number> = { 2026: 6 };

const DATA_DIR = process.env.INVOICES_DATA_DIR || path.join(process.cwd(), "data", "invoices");
const FILE = path.join(DATA_DIR, "invoices.json");
// Uploaded = an older invoice made elsewhere (PDF/photo kept as a file); it still counts for the numbering.
type Client = { id: string; label: string; name: string; business: string; address1: string; address2: string; uid: string; service: string };
const DEFAULT_CLIENTS: Client[] = [{ id: "airtiketa", label: "AIRTIKETA", name: "Airtiketa GmbH", business: "HRB 728839", address1: "Colmarer Str. 1",
  address2: "79576 Weil am Rhein, Gjermani", uid: "N/A", service: "Te ardhura nga rrjetet sociale:\nFacebook" }];
// clientData = the client's details copied into the invoice when it is created, so editing a client later never changes old invoices.
type Invoice = { clientData?: Client; id: string; client: string; year: number; seq: number; number: string; date: string; amount: number; createdAt: string; updatedAt: string; file?: string; fileType?: string; fileName?: string };
const FILES_DIR = path.join(DATA_DIR, "files");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");
let clientWriting: Promise<unknown> = Promise.resolve();

async function readClients(): Promise<Client[]> {
  try {
    const list = JSON.parse(await readFile(CLIENTS_FILE, "utf8"));
    return Array.isArray(list) && list.length ? list : DEFAULT_CLIENTS;
  } catch { return DEFAULT_CLIENTS; }
}

function saveClient(client: Client) {
  const next = clientWriting.then(async () => {
    const list = await readClients();
    const exists = list.some((item) => item.id === client.id);
    const updated = exists ? list.map((item) => item.id === client.id ? client : item) : [...list, client];
    await mkdir(DATA_DIR, { recursive: true });
    const temp = `${CLIENTS_FILE}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(updated, null, 1));
    await rename(temp, CLIENTS_FILE);
    return updated;
  });
  clientWriting = next.catch(() => undefined);
  return next;
}
const UPLOAD_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_UPLOAD = 15 * 1024 * 1024;
let writing: Promise<unknown> = Promise.resolve();

function same(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const split = decoded.indexOf(":");
  return split >= 0 && same(decoded.slice(0, split), USER) && same(decoded.slice(split + 1), PASS);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === (request.headers.get("host") ?? new URL(request.url).host); } catch { return false; }
}

async function readInvoices(): Promise<Invoice[]> {
  try {
    const list = JSON.parse(await readFile(FILE, "utf8"));
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

// One write at a time: two invoices saved at the same moment can never get the same number.
function update<T>(change: (list: Invoice[]) => { list: Invoice[]; result: T }) {
  const next = writing.then(async () => {
    const { list, result } = change(await readInvoices());
    await mkdir(DATA_DIR, { recursive: true });
    const temp = `${FILE}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(list, null, 1));
    await rename(temp, FILE);
    return { list, result };
  });
  writing = next.catch(() => undefined);
  return next;
}

function nextSeq(list: Invoice[], year: number) {
  return Math.max(START[year] ?? 0, ...list.filter((item) => item.year === year).map((item) => item.seq)) + 1;
}

const formatNumber = (seq: number, year: number) => `#${String(seq).padStart(2, "0")}/${year}`;
const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
const validAmount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value < 1e11 ? value : null;
const sorted = (list: Invoice[]) => [...list].sort((a, b) => b.year - a.year || b.seq - a.seq);

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
const denied = () => new Response("Kërkohet hyrja.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Momenti Faturat", charset="UTF-8"', "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  if (!authorized(request)) return denied();
  const params = new URL(request.url).searchParams;
  const fileId = params.get("file");
  if (fileId) {
    const invoice = (await readInvoices()).find((item) => item.id === fileId && item.file);
    if (!invoice?.file) return json({ error: "Skedari nuk u gjet." }, 404);
    const data = await readFile(path.join(FILES_DIR, path.basename(invoice.file))).catch(() => null);
    if (!data) return json({ error: "Skedari nuk u gjet." }, 404);
    const name = encodeURIComponent(invoice.fileName || invoice.file);
    return new Response(new Uint8Array(data), { headers: {
      "Content-Type": invoice.fileType || "application/pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${params.has("download") ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
    } });
  }
  if (params.has("list")) {
    const list = await readInvoices();
    const year = new Date().getFullYear();
    return json({ invoices: sorted(list), clients: await readClients(), next: formatNumber(nextSeq(list, year), year) });
  }
  return new Response(PAGE.replace("__LOGO__", LOGO).replace("__STAMP__", STAMP), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) return denied();
  if (!sameOrigin(request)) return json({ error: "Kërkesë e pavlefshme." }, 403);
  if (new URL(request.url).searchParams.has("upload")) return upload(request);
  if (new URL(request.url).searchParams.has("client")) return clientSave(request);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const date = validDate(body?.date);
  const amount = validAmount(body?.amount);
  const id = typeof body?.id === "string" ? body.id : "";
  const clients = await readClients();
  const clientData = clients.find((item) => item.id === body?.client) ?? null;
  const client = clientData?.id ?? null;
  if (!date || !amount || (!id && !client)) return json({ error: "Plotëso vlerën dhe datën." }, 400);
  const now = new Date().toISOString();
  const { list, result } = await update((current) => {
    if (id) {
      // Editing keeps the invoice number; only the value and date change.
      const existing = current.find((item) => item.id === id);
      if (!existing || existing.file) return { list: current, result: null as Invoice | null };
      const changed = { ...existing, date, amount, updatedAt: now };
      return { list: current.map((item) => item.id === id ? changed : item), result: changed };
    }
    const year = Number(date.slice(0, 4));
    const seq = nextSeq(current, year);
    const invoice: Invoice = { id: randomUUID(), client: client!, clientData: clientData!, year, seq, number: formatNumber(seq, year), date, amount, createdAt: now, updatedAt: now };
    return { list: [...current, invoice], result: invoice };
  });
  if (!result) return json({ error: "Fatura nuk u gjet." }, 404);
  const year = new Date().getFullYear();
  return json({ invoice: result, invoices: sorted(list), next: formatNumber(nextSeq(list, year), year) });
}

async function clientSave(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const text = (key: string, max: number) => typeof body?.[key] === "string" ? (body[key] as string).replace(/\r/g, "").trim().slice(0, max) : "";
  const label = text("label", 40).toUpperCase();
  const name = text("name", 80);
  if (!label || !name) return json({ error: "Shkruaj emrin e klientit." }, 400);
  const list = await readClients();
  const id = text("id", 60);
  if (id && !list.some((item) => item.id === id)) return json({ error: "Klienti nuk u gjet." }, 404);
  const slug = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "klient";
  const client: Client = {
    id: id || (list.some((item) => item.id === slug) ? `${slug}-${randomUUID().slice(0, 4)}` : slug),
    label, name, business: text("business", 60), address1: text("address1", 80), address2: text("address2", 80),
    uid: text("uid", 40) || "N/A", service: text("service", 160) || "Te ardhura nga rrjetet sociale:\nFacebook",
  };
  const clients = await saveClient(client);
  return json({ client, clients });
}

async function upload(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const client = String(form?.get("client") ?? "");
  const match = String(form?.get("number") ?? "").match(/^\s*#?\s*(\d{1,4})\s*[/.\-]\s*(\d{4})\s*$/);
  const date = validDate(form?.get("date"));
  const amountText = String(form?.get("amount") ?? "").trim();
  const amount = amountText ? validAmount(Number(amountText)) : 0;
  if (!(file instanceof File) || !file.size) return json({ error: "Zgjidh skedarin e faturës (PDF ose foto)." }, 400);
  const ext = UPLOAD_TYPES[file.type];
  if (!ext) return json({ error: "Lejohen vetëm PDF, JPG, PNG ose WebP." }, 415);
  if (file.size > MAX_UPLOAD) return json({ error: "Skedari kalon kufirin 15 MB." }, 413);
  if (!(await readClients()).some((item) => item.id === client)) return json({ error: "Zgjidh klientin." }, 400);
  if (!match) return json({ error: "Shkruaj numrin e faturës, p.sh. #05/2026." }, 400);
  if (!date) return json({ error: "Zgjidh datën e faturës." }, 400);
  if (amount === null) return json({ error: "Vlera nuk është e saktë." }, 400);
  const seq = Number(match[1]), year = Number(match[2]);
  if (!seq || year < 2000 || year > 2100) return json({ error: "Numri i faturës nuk është i saktë." }, 400);
  const id = randomUUID();
  const stored = `${id}.${ext}`;
  await mkdir(FILES_DIR, { recursive: true });
  await writeFile(path.join(FILES_DIR, stored), new Uint8Array(await file.arrayBuffer()));
  const now = new Date().toISOString();
  const number = formatNumber(seq, year);
  const { list, result } = await update((current) => {
    if (current.some((item) => item.number === number)) return { list: current, result: null as Invoice | null };
    const invoice: Invoice = { id, client, year, seq, number, date, amount: amount || 0, createdAt: now, updatedAt: now,
      file: stored, fileType: file.type, fileName: file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) };
    return { list: [...current, invoice], result: invoice };
  });
  if (!result) {
    await unlink(path.join(FILES_DIR, stored)).catch(() => undefined);
    return json({ error: `Fatura ${number} ekziston tashmë.` }, 409);
  }
  const thisYear = new Date().getFullYear();
  return json({ invoice: result, invoices: sorted(list), next: formatNumber(nextSeq(list, thisYear), thisYear) });
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return denied();
  if (!sameOrigin(request)) return json({ error: "Kërkesë e pavlefshme." }, 403);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const { list, result } = await update((current) => ({ list: current.filter((item) => item.id !== id), result: current.find((item) => item.id === id)?.file ?? null }));
  if (result) await unlink(path.join(FILES_DIR, path.basename(result))).catch(() => undefined);
  const year = new Date().getFullYear();
  return json({ invoices: sorted(list), next: formatNumber(nextSeq(list, year), year) });
}

const PAGE = String.raw`<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Faturat · Momenti Media</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root{--red:#9b0019;--navy:#0f1c3f;--beige:#f5f0e6;--muted:#6b6f80;--line:#e3dccf}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:Outfit,Segoe UI,Arial,sans-serif;color:var(--navy);background:radial-gradient(90% 60% at 100% 0%,rgba(161,40,58,.35),transparent 65%),linear-gradient(180deg,#34101a,#2c0b11);padding:24px 16px 48px}
.wrap{max-width:1100px;margin:0 auto}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#fff4ef;margin-bottom:18px}
.top h1{margin:0;font-size:24px;font-weight:800}
.top a,.link{color:#ffb4bb;font-weight:600;font-size:14px;text-decoration:none;cursor:pointer;background:none;border:0;font-family:inherit;padding:0}
h2{color:#fff4ef;font-size:17px;margin:26px 0 10px}
.clients{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.client{background:#fbfaf6;border-radius:16px;padding:18px;cursor:pointer;border:2px solid transparent;text-align:left;font-family:inherit;color:inherit}
.client:hover{border-color:#c9a2a7}
.client b{display:block;font-size:20px;font-weight:800;color:var(--red);letter-spacing:.02em}
.client small{color:var(--muted);font-size:13px}
.inv{display:grid;grid-template-columns:110px 1fr 120px 130px auto;gap:12px;align-items:center;background:#fbfaf6;border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:pointer;border:2px solid transparent;font-variant-numeric:tabular-nums}
.inv:hover{border-color:#c9a2a7}
.inv .no{font-weight:800;color:var(--red);font-size:16px}
.inv .amt{font-weight:800;text-align:right}
.inv .acts{display:flex;gap:6px;justify-content:flex-end}
.empty{color:#d9c3c0;font-size:14px}
.client-add{background:transparent;border:2px dashed rgba(255,214,219,.35);color:#ffd9dd;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;min-height:86px}
.client-add:hover{border-color:#ffb4bb}
.client .edit-cl{float:right;font-size:12px;color:var(--muted);font-weight:600;text-decoration:underline}
.cl-title{margin:0 0 12px;color:var(--red);font-size:18px}
.cl-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0 12px}
.cl-grid .wide{grid-column:1/-1}
.cl-grid input,.cl-grid textarea{font-size:16px;padding:10px 12px}
textarea{font:inherit;font-weight:700;color:var(--navy);border:1.5px solid var(--line);border-radius:12px;background:#fff;width:100%;resize:vertical;outline:none}
#clForm{margin-top:12px}
.list-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:26px 0 10px}.list-head h2{margin:0}
.upload{background:#fbfaf6;border-radius:16px;padding:18px;margin-bottom:12px}
.up-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:12px}
.up-grid label{margin-bottom:12px}
.up-grid input,.up-grid select{font-size:16px;padding:10px 12px}
select{font:inherit;font-weight:700;color:var(--navy);border:1.5px solid var(--line);border-radius:12px;background:#fff;width:100%}
.upload .status{margin:0;align-self:center}
.tag{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;background:#efe6d6;color:#7a5a2a;font-size:11px;font-weight:700;letter-spacing:.03em;vertical-align:middle}
.file-view{width:100%;height:80vh;border:0;border-radius:6px;background:#fff;display:block}
.file-img{width:100%;border-radius:6px;display:block;background:#fff}
button.btn{font:inherit;font-weight:700;border:0;border-radius:10px;padding:10px 16px;cursor:pointer;background:#6d1b27;color:#fff}
button.ghost{background:transparent;color:var(--muted);border:1.5px solid var(--line)}
button.small{padding:6px 10px;font-size:13px}
button:disabled{opacity:.55;cursor:default}
.editor{display:grid;grid-template-columns:320px 1fr;gap:18px;align-items:start}
.panel{background:#fbfaf6;border-radius:16px;padding:18px;position:sticky;top:16px}
.panel h3{margin:0 0 4px;font-size:20px;color:var(--red)}
.panel p{margin:0 0 14px;color:var(--muted);font-size:13px}
label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;margin-bottom:14px}
input{font:inherit;font-size:20px;font-weight:700;color:var(--navy);padding:11px 13px;border:1.5px solid var(--line);border-radius:12px;background:#fff;outline:none;width:100%}
input:focus{border-color:var(--navy)}
input[readonly]{background:#f2efe8;color:var(--muted)}
.fixed{font-size:20px;font-weight:800;color:var(--navy);padding:4px 0}
.row2{display:flex;justify-content:space-between;align-items:center;gap:8px}
.status{font-size:13px;color:var(--muted);min-height:18px;margin:10px 0 0}
.buttons{display:flex;flex-wrap:wrap;gap:8px}
.preview{background:rgba(255,255,255,.04);border-radius:16px;padding:12px}
.paper-box{width:100%;position:relative;overflow:hidden;border-radius:6px;box-shadow:0 18px 40px rgba(18,3,6,.35)}
.modal{position:fixed;inset:0;z-index:20;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 16px;background:rgba(20,4,8,.78)}
.modal.is-open{display:flex}
.modal-in{width:100%;max-width:820px}
.modal-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;color:#fff4ef;flex-wrap:wrap}
body.modal-open{overflow:hidden}
.hidden{display:none!important}

/* The invoice itself: a fixed 1414 × 2000 px A4 page (same layout as the Canva template), scaled to fit. */
.paper{position:absolute;left:0;top:0;width:1414px;height:2000px;background:#fff;transform-origin:0 0;color:var(--navy);font-family:Outfit,Arial,sans-serif;overflow:hidden}
.paper *{position:absolute;margin:0;white-space:nowrap}
.p-band{left:0;top:0;width:1414px;height:368px;background:var(--red)}
.p-company{left:0;width:1414px;top:72px;text-align:center;color:#fff;font-size:82px;font-weight:700;letter-spacing:.005em;padding-left:80px}
.p-logo{left:518px;top:196px;width:372px;height:146px}
.p-title{left:112px;top:405px;width:518px;height:140px}
.p-k{left:725px;font-size:27px;font-weight:700}
.p-v{left:980px;font-size:27px;font-weight:700}
.p-ul{height:2px;background:var(--navy)}
.p-to{left:115px;top:596px;font-size:30px;font-weight:700;line-height:44.5px;white-space:pre}
.p-by{left:725px;top:596px;font-size:30px;font-weight:700}
.p-by2{left:732px;top:658px;font-size:27px;font-weight:400}
.p-addr{left:732px;top:704px;font-size:31px;font-weight:400;line-height:40px;white-space:pre;letter-spacing:.01em}
.p-bar{left:108px;top:922px;width:1140px;height:106px;background:var(--red)}
.p-bar span{top:34px;color:#fff;font-size:30px;font-weight:700}
.p-head{left:108px;top:1090px;width:1140px;height:106px;background:var(--beige)}
.p-head span{top:34px;color:var(--red);font-size:31px;font-weight:700}
.p-svc{left:132px;top:1220px;font-size:27px;font-weight:700;line-height:34px;white-space:pre}
.p-price{right:234px;top:1220px;font-size:27px;font-weight:400}
.p-line{left:107px;top:1411px;width:1137px;height:2px;background:var(--navy)}
.p-bank{left:115px;top:1458px;font-size:31px;font-weight:700}
.p-bank2{left:115px;top:1508px;font-size:27px;line-height:38px;white-space:pre}
.p-thanks{left:115px;top:1625px;font-size:27px;line-height:34px;white-space:pre}
.p-note{left:115px;top:1710px;font-size:27px;font-weight:700;line-height:34px;color:#8a2430;white-space:pre}
.p-totk{left:665px;top:1448px;font-size:25px;font-weight:700}
.p-total{right:220px;top:1446px;font-size:64px;font-weight:800}
.p-totline{left:667px;top:1536px;width:577px;height:2px;background:var(--navy)}
.p-stamp{left:762px;top:1500px;width:304px;height:304px;transform:rotate(-24deg)}
.p-sign{left:670px;top:1636px;font-size:27px;font-weight:700}
.p-sline{height:2px;background:var(--navy);top:1682px}
.p-slabel{top:1690px;font-size:27px}
.p-foot{left:0;top:1775px;width:1414px;height:225px;background:var(--beige)}
.p-mail{left:175px;top:1872px;width:36px;height:36px}
.p-mailt{left:222px;top:1872px;font-size:28px}
.p-fb{left:748px;top:1862px;width:28px;height:56px}
.p-fbt{left:786px;top:1872px;font-size:28px}
.p-fbt u{position:static;text-decoration:underline}

.pdf-stage{position:fixed;left:-20000px;top:0;width:1414px;height:2000px}
.pdf-stage .paper{transform:none}
@media (max-width:860px){.up-grid{grid-template-columns:1fr 1fr}.up-grid label:first-child{grid-column:1/-1}.editor{grid-template-columns:1fr}.panel{position:static}.inv{grid-template-columns:90px 1fr 110px;}.inv .date{display:none}.inv .acts{grid-column:1/-1}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><h1>Faturat · Momenti Media</h1><button class="link hidden" id="back" type="button">← Të gjitha faturat</button></div>

  <div id="home">
    <h2>Klientët</h2>
    <div class="clients" id="clients">
    </div>
    <form class="upload hidden" id="clForm">
      <h3 class="cl-title" id="clTitle">Klient i ri</h3>
      <div class="cl-grid">
        <label>Emri i shkurtër<input id="clLabel" placeholder="AIRTIKETA" autocomplete="off"></label>
        <label>Emri i plotë (në faturë)<input id="clName" placeholder="Airtiketa GmbH" autocomplete="off"></label>
        <label>Nr. Biznesit<input id="clBusiness" placeholder="HRB 728839" autocomplete="off"></label>
        <label>NR. unik identifikues<input id="clUid" placeholder="N/A" autocomplete="off"></label>
        <label>Adresa<input id="clAddress1" placeholder="Colmarer Str. 1" autocomplete="off"></label>
        <label>Qyteti, shteti<input id="clAddress2" placeholder="79576 Weil am Rhein, Gjermani" autocomplete="off"></label>
        <label class="wide">Shërbimi (në faturë)<textarea id="clService" rows="2">Te ardhura nga rrjetet sociale:
Facebook</textarea></label>
      </div>
      <div class="buttons"><button class="btn" type="submit" id="clSave">Ruaj klientin</button><button class="btn ghost" type="button" id="clCancel">Anulo</button><span class="status" id="clStatus"></span></div>
    </form>
    <div class="list-head"><h2>Të gjitha faturat</h2><button class="btn small" type="button" id="upOpen">+ Ngarko faturë</button></div>
    <form class="upload hidden" id="upForm">
      <div class="up-grid">
        <label>Skedari (PDF ose foto)<input id="upFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></label>
        <label>Klienti<select id="upClient"></select></label>
        <label>Nr. Faturës<input id="upNumber" placeholder="#05/2026" autocomplete="off"></label>
        <label>Data<input id="upDate" type="date"></label>
        <label>Vlera (€)<input id="upAmount" inputmode="decimal" placeholder="3.232" autocomplete="off"></label>
      </div>
      <div class="buttons"><button class="btn" type="submit" id="upSave">Ruaj faturën</button><button class="btn ghost" type="button" id="upCancel">Anulo</button><span class="status" id="upStatus"></span></div>
    </form>
    <div id="list"><div class="empty">Duke i ngarkuar…</div></div>
  </div>

  <div id="edit" class="hidden">
    <div class="editor">
      <div class="panel">
        <h3 id="edTitle">AIRTIKETA · Faturë e re</h3>
        <p id="edHint">Ndrysho vetëm vlerën. Numri i faturës jepet automatikisht.</p>
        <label>Nr. Faturës<div class="fixed" id="edNumber">—</div></label>
        <label>Vlera (€)<input id="edAmount" inputmode="decimal" placeholder="3.232" autocomplete="off"></label>
        <label><span class="row2"><span>Data</span><button class="link" style="color:#6d1b27;text-transform:none;letter-spacing:0" type="button" id="edDateToggle">Ndrysho datën</button></span><input id="edDate" type="date" readonly></label>
        <div class="buttons">
          <button class="btn" type="button" id="edSave">Ruaj faturën</button>
          <button class="btn ghost" type="button" id="edPdf">Ruaj PDF</button>
        </div>
        <div class="status" id="edStatus"></div>
      </div>
      <div class="preview"><div class="paper-box" id="edPaper"></div></div>
    </div>
  </div>
</div>

<div class="modal" id="modal" role="dialog" aria-modal="true">
  <div class="modal-in">
    <div class="modal-head"><b id="mTitle"></b><div class="buttons">
      <button class="btn ghost small" style="color:#fff4ef" type="button" id="mClose">Mbyll</button>
      <button class="btn ghost small" style="color:#fff4ef" type="button" id="mEdit">Edito</button>
      <button class="btn small" type="button" id="mPdf">Ruaj PDF</button>
    </div></div>
    <div class="paper-box" id="mPaper"></div>
  </div>
</div>

<script>
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var LOGO = "__LOGO__", STAMP = "__STAMP__";
  var CLIENTS = {}, clientList = [];
  function lines(c){ return [c.name, c.business ? "Nr. Biznesit: " + c.business : "", c.address1, c.address2].filter(Boolean).join("\n"); }
  function clientOf(inv){ return inv.clientData || CLIENTS[inv.client] || { label: inv.client, name: inv.client, service: "", uid: "N/A" }; }
  var invoices = [], nextNo = "", editing = null, editClient = "airtiketa";
  function esc(t){ return String(t).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function cents(text){
    var s = String(text||"").replace(/[^0-9.,]/g,""); if(!s) return 0;
    var lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(","), dec = Math.max(lastDot, lastComma);
    var decimals = dec >= 0 ? s.length - dec - 1 : 0, multipleDots = (s.match(/\./g)||[]).length > 1;
    if (dec < 0 || (lastComma < 0 && (multipleDots || decimals === 3))) return Math.round(Number(s.replace(/[.,]/g,""))*100) || 0;
    return (Number(s.slice(0, dec).replace(/[.,]/g,"")||0)*100 + Number((s.slice(dec+1)+"00").slice(0,2))) || 0;
  }
  function money(c){
    var e = Math.floor(c/100).toString().replace(/\B(?=(\d{3})+(?!\d))/g,".");
    return "€ " + e + (c % 100 ? "," + String(c%100).padStart(2,"0") : "");
  }
  function plain(c){ var e = Math.floor(c/100).toString().replace(/\B(?=(\d{3})+(?!\d))/g,"."); return e + (c % 100 ? "," + String(c%100).padStart(2,"0") : ""); }
  function dmy(iso){ var p = String(iso||"").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; }
  function today(){ var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }

  function paperHtml(inv){
    var c = clientOf(inv), amt = inv.amount ? money(inv.amount) : "€ —";
    return '<div class="paper">'
      + '<div class="p-band"></div><div class="p-company">Momenti Media SH.P.K</div><img class="p-logo" src="' + LOGO + '" alt="">'
      + '<svg class="p-title" viewBox="0 0 518 140"><text x="0" y="132" textLength="518" lengthAdjust="spacingAndGlyphs" font-family="Outfit, Arial, sans-serif" font-weight="800" font-size="158" fill="#9b0019">FATURË</text></svg>'
      + '<div class="p-k" style="top:382px">Nr. Biznesit</div><div class="p-v" style="top:382px">812409820</div>'
      + '<div class="p-ul" style="left:725px;top:432px;width:116px"></div><div class="p-ul" style="left:980px;top:432px;width:350px"></div>'
      + '<div class="p-k" style="top:447px">Nr. Faturës</div><div class="p-v" style="top:447px">' + esc(inv.number || "—") + '</div>'
      + '<div class="p-ul" style="left:725px;top:486px;width:116px"></div><div class="p-ul" style="left:980px;top:486px;width:350px"></div>'
      + '<div class="p-k" style="top:518px">Data</div><div class="p-v" style="top:518px">' + esc(dmy(inv.date)) + '</div>'
      + '<div class="p-ul" style="left:725px;top:555px;width:116px"></div><div class="p-ul" style="left:980px;top:555px;width:350px"></div>'
      + '<div class="p-to">Faturë për:\n' + esc(lines(c)) + '</div>'
      + '<div class="p-by">Faturoi</div><div class="p-ul" style="left:725px;top:645px;width:116px"></div>'
      + '<div class="p-by2">Emri:<span style="left:128px;top:0">Momenti Media SH.P.K</span></div>'
      + '<div class="p-addr">Adresa: GURSEL DHE BAJRAM\nSYLEJMANI, 274</div>'
      + '<div class="p-bar"><span style="left:24px">Faturë për: ' + esc(c.name) + '</span><span style="left:544px">NR. unik identifikues:</span><span style="left:930px">' + esc(c.uid) + '</span></div>'
      + '<div class="p-head"><span style="left:30px">SHËRBIMI</span><span style="right:66px">CMIMI</span></div>'
      + '<div class="p-svc">' + esc(c.service) + '</div><div class="p-price">' + esc(amt) + '</div>'
      + '<div class="p-line"></div>'
      + '<div class="p-bank">Të dhënat bankare</div>'
      + '<div class="p-bank2"><b style="position:static">Account holder</b>: Momenti Media SH.P.K\n<b style="position:static">IBAN</b>: GB28MOOW00993554710280</div>'
      + '<div class="p-thanks">Faleminderit që zgjodhët të\nbashkëpunoni me ne!</div>'
      + '<div class="p-note">Vini re: Afati kohor i pageses\nështë 15 ditë</div>'
      + '<div class="p-totk">TOTALI</div><div class="p-total">' + esc(amt) + '</div><div class="p-totline"></div>'
      + '<div class="p-sign">Rrezon Elmazi</div>'
      + '<div class="p-sline" style="left:667px;width:183px"></div><div class="p-slabel" style="left:710px">Faturoi</div>'
      + '<div class="p-sline" style="left:1052px;width:194px;top:1680px"></div><div class="p-slabel" style="left:1100px">Pranoi</div>'
      + '<img class="p-stamp" src="' + STAMP + '" alt="">'
      + '<div class="p-foot"></div>'
      + '<svg class="p-mail" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#0f1c3f"/><rect x="5.5" y="7.5" width="13" height="9" rx="1.2" fill="#fff"/><path d="M5.8 8l6.2 4.6L18.2 8" fill="none" stroke="#0f1c3f" stroke-width="1.4"/></svg>'
      + '<div class="p-mailt">momentimedia.ou@gmail.com</div>'
      + '<svg class="p-fb" viewBox="0 0 14 28"><path d="M9.2 28V15.3h3.9l.6-4.8H9.2V7.5c0-1.4.4-2.3 2.3-2.3H14V.9C13.6.8 12.1.7 10.4.7 6.8.7 4.3 2.9 4.3 6.9v3.6H.4v4.8h3.9V28z" fill="#0f1c3f"/></svg>'
      + '<div class="p-fbt"><u>fb.com/</u>gazetamomenti</div>'
      + '</div>';
  }
  // Scale the fixed 1414 px page to whatever width the box has.
  function mount(box, inv){
    box.innerHTML = paperHtml(inv);
    var fit = function(){ var s = box.clientWidth / 1414; box.style.height = (2000 * s) + "px"; box.firstChild.style.transform = "scale(" + s + ")"; };
    fit(); requestAnimationFrame(fit);
  }
  window.addEventListener("resize", function(){ document.querySelectorAll(".paper-box").forEach(function(box){ if(box.firstChild){ var s = box.clientWidth / 1414; box.style.height = (2000*s) + "px"; box.firstChild.style.transform = "scale(" + s + ")"; } }); });

  // ---- PDF (same libraries as the calculator)
  function loadScript(src){ return new Promise(function(ok, fail){ var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); }); }
  var libs = null;
  function pdfLibs(){ return libs || (libs = Promise.all([
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"),
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")]).catch(function(e){ libs = null; throw e; })); }
  function savePdf(inv, button, statusEl){
    var label = button.textContent; button.disabled = true; button.textContent = "Duke krijuar…";
    var stage = document.createElement("div"); stage.className = "pdf-stage"; stage.innerHTML = paperHtml(inv); document.body.appendChild(stage);
    pdfLibs().then(function(){ return document.fonts ? document.fonts.ready : null; })
      .then(function(){ return window.html2canvas(stage.firstChild, { scale: 1.5, backgroundColor: "#ffffff", width: 1414, height: 2000, windowWidth: 1414 }); })
      .then(function(canvas){
        var pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
        pdf.save("Fatura-" + String(inv.number || "e-re").replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "") + "-" + String(clientOf(inv).label).replace(/[^0-9A-Za-z]+/g, "-") + ".pdf");
        if(statusEl) statusEl.textContent = "PDF u ruajt ✓";
      })
      .catch(function(){ if(statusEl) statusEl.textContent = "PDF nuk u krijua. Kontrollo internetin dhe provo përsëri."; })
      .then(function(){ stage.remove(); button.disabled = false; button.textContent = label; });
  }

  // ---- data
  function setData(res){ invoices = res.invoices || []; nextNo = res.next || ""; if(res.clients) setClients(res.clients); showList(); }
  function setClients(list){
    clientList = list; CLIENTS = {}; list.forEach(function(c){ CLIENTS[c.id] = c; });
    $("clients").innerHTML = list.map(function(c){
      return '<button class="client" type="button" data-client="' + esc(c.id) + '"><span class="edit-cl" data-edit-client="' + esc(c.id) + '">Edito</span><b>' + esc(c.label) + '</b><small>' + esc(c.name) + ' · Faturë e re <span class="nextno">' + esc(nextNo) + '</span></small></button>';
    }).join("") + '<button class="client client-add" type="button" id="clOpen">+ Shto klient</button>';
    var sel = $("upClient"), keep = sel.value;
    sel.innerHTML = list.map(function(c){ return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>'; }).join("");
    if(keep && CLIENTS[keep]) sel.value = keep;
  }
  function load(){
    fetch("/faturat?list=1", { credentials: "same-origin", cache: "no-store" }).then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(setData).catch(function(){ $("list").innerHTML = '<div class="empty">Faturat nuk u ngarkuan. Rifresko faqen.</div>'; });
  }
  function showList(){
    document.querySelectorAll(".nextno").forEach(function(el){ el.textContent = nextNo; });
    if(!invoices.length){ $("list").innerHTML = '<div class="empty">Ende nuk ka fatura. Kliko AIRTIKETA për të krijuar të parën.</div>'; return; }
    $("list").innerHTML = invoices.map(function(inv){
      var c = clientOf(inv);
      return '<div class="inv" data-id="' + esc(inv.id) + '"><span class="no">' + esc(inv.number) + '</span><span>' + esc(c.label) + (inv.file ? '<span class="tag">E NGARKUAR</span>' : '') + '</span><span class="date">' + esc(dmy(inv.date)) + '</span><span class="amt">' + (inv.amount ? esc(money(inv.amount)) : "—") + '</span>'
        + '<span class="acts">' + (inv.file ? '' : '<button class="btn ghost small" type="button" data-edit="' + esc(inv.id) + '">Edito</button>') + '<button class="btn ghost small" type="button" data-del="' + esc(inv.id) + '">Fshi</button></span></div>';
    }).join("");
  }

  // ---- views
  function show(view){ $("home").classList.toggle("hidden", view !== "home"); $("edit").classList.toggle("hidden", view !== "edit"); $("back").classList.toggle("hidden", view === "home"); window.scrollTo(0, 0); }
  function draft(){ return { client: editClient, clientData: editing ? editing.clientData : CLIENTS[editClient], number: editing ? editing.number : nextNo, date: $("edDate").value || today(), amount: cents($("edAmount").value) }; }
  function refresh(){ mount($("edPaper"), draft()); }
  function openEditor(inv, client){
    editing = inv || null; editClient = inv ? inv.client : client;
    var c = inv ? clientOf(inv) : CLIENTS[editClient];
    $("edTitle").textContent = c.label + (inv ? " · Edito " + inv.number : " · Faturë e re");
    $("edHint").textContent = inv ? "Numri i faturës mbetet " + inv.number + ". Ndrysho vlerën ose datën." : "Ndrysho vetëm vlerën. Numri i faturës jepet automatikisht.";
    $("edNumber").textContent = inv ? inv.number : (nextNo + " (automatik)");
    $("edAmount").value = inv ? plain(inv.amount) : "";
    $("edDate").value = inv ? inv.date : today(); $("edDate").readOnly = true; $("edDateToggle").textContent = "Ndrysho datën";
    $("edStatus").textContent = "";
    show("edit"); refresh(); $("edAmount").focus();
  }
  $("edAmount").addEventListener("input", refresh);
  $("edDate").addEventListener("input", refresh);
  $("edDateToggle").addEventListener("click", function(){
    var input = $("edDate");
    if(input.readOnly){ input.readOnly = false; input.focus(); this.textContent = "Data e sotme"; }
    else { input.value = today(); input.readOnly = true; this.textContent = "Ndrysho datën"; refresh(); }
  });
  $("edSave").addEventListener("click", function(){
    var d = draft(), btn = this;
    if(!d.amount){ $("edStatus").textContent = "Shkruaj vlerën e faturës."; $("edAmount").focus(); return; }
    btn.disabled = true; $("edStatus").textContent = "Duke ruajtur…";
    fetch("/faturat", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, date: d.date, amount: d.amount } : { client: d.client, date: d.date, amount: d.amount }) })
      .then(function(r){ return r.json().then(function(b){ if(!r.ok) throw new Error(b.error || ""); return b; }); })
      .then(function(res){
        setData(res); editing = res.invoice;
        $("edTitle").textContent = clientOf(res.invoice).label + " · " + res.invoice.number;
        $("edNumber").textContent = res.invoice.number; refresh();
        $("edStatus").textContent = "Fatura " + res.invoice.number + " u ruajt ✓";
      })
      .catch(function(e){ $("edStatus").textContent = e.message || "Ruajtja dështoi. Provo përsëri."; })
      .then(function(){ btn.disabled = false; });
  });
  $("edPdf").addEventListener("click", function(){
    var d = draft();
    if(!editing){ $("edStatus").textContent = "Ruaje faturën fillimisht, që të marrë numrin e saj."; return; }
    savePdf(d, this, $("edStatus"));
  });
  $("back").addEventListener("click", function(){ show("home"); });
  // ---- clients
  var clientEditing = null;
  function openClientForm(c){
    clientEditing = c || null;
    $("clTitle").textContent = c ? "Edito klientin " + c.label : "Klient i ri";
    $("clLabel").value = c ? c.label : ""; $("clName").value = c ? c.name : ""; $("clBusiness").value = c ? c.business : "";
    $("clUid").value = c ? c.uid : "N/A"; $("clAddress1").value = c ? c.address1 : ""; $("clAddress2").value = c ? c.address2 : "";
    $("clService").value = c ? c.service : "Te ardhura nga rrjetet sociale:\nFacebook"; $("clStatus").textContent = c ? "Ndryshimet vlejnë për faturat e reja; faturat e vjetra mbeten siç janë." : "";
    $("clForm").classList.remove("hidden"); $("clLabel").focus();
  }
  $("clients").addEventListener("click", function(e){
    var ed = e.target.closest("[data-edit-client]");
    if(ed){ e.stopPropagation(); openClientForm(CLIENTS[ed.getAttribute("data-edit-client")]); return; }
    if(e.target.closest("#clOpen")){ openClientForm(null); return; }
    var btn = e.target.closest("[data-client]"); if(btn) openEditor(null, btn.getAttribute("data-client"));
  });
  $("clCancel").addEventListener("click", function(){ $("clForm").classList.add("hidden"); });
  $("clForm").addEventListener("submit", function(e){
    e.preventDefault();
    var body = { id: clientEditing ? clientEditing.id : "", label: $("clLabel").value, name: $("clName").value, business: $("clBusiness").value,
      uid: $("clUid").value, address1: $("clAddress1").value, address2: $("clAddress2").value, service: $("clService").value };
    if(!body.label.trim() || !body.name.trim()){ $("clStatus").textContent = "Shkruaj emrin e shkurtër dhe emrin e plotë."; return; }
    $("clSave").disabled = true; $("clStatus").textContent = "Duke ruajtur…";
    fetch("/faturat?client=1", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function(r){ return r.json().then(function(b){ if(!r.ok) throw new Error(b.error || ""); return b; }); })
      .then(function(res){ setClients(res.clients); $("clForm").classList.add("hidden"); })
      .catch(function(err){ $("clStatus").textContent = err.message || "Ruajtja dështoi."; })
      .then(function(){ $("clSave").disabled = false; });
  });

  var opened = null;
  function openModal(inv){
    opened = inv; $("mTitle").textContent = inv.number + " · " + clientOf(inv).label + (inv.file ? " · e ngarkuar" : "");
    $("mEdit").classList.toggle("hidden", Boolean(inv.file));
    $("mPdf").textContent = inv.file ? "Shkarko" : "Ruaj PDF";
    $("modal").classList.add("is-open"); document.body.classList.add("modal-open");
    if(inv.file){
      var src = "/faturat?file=" + encodeURIComponent(inv.id);
      $("mPaper").style.height = "auto";
      $("mPaper").innerHTML = (inv.fileType || "").indexOf("image/") === 0 ? '<img class="file-img" src="' + src + '" alt="">' : '<iframe class="file-view" src="' + src + '" title="Fatura"></iframe>';
    } else mount($("mPaper"), inv);
  }
  function closeModal(){ $("modal").classList.remove("is-open"); document.body.classList.remove("modal-open"); opened = null; }
  $("mClose").addEventListener("click", closeModal);
  $("modal").addEventListener("click", function(e){ if(e.target === $("modal")) closeModal(); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && opened) closeModal(); });
  $("mEdit").addEventListener("click", function(){ var inv = opened; closeModal(); openEditor(inv); });
  $("mPdf").addEventListener("click", function(){
    if(!opened) return;
    if(opened.file){ var a = document.createElement("a"); a.href = "/faturat?file=" + encodeURIComponent(opened.id) + "&download=1"; document.body.appendChild(a); a.click(); a.remove(); return; }
    savePdf(opened, this, null);
  });
  // ---- upload older invoices
  function showUpload(on){ $("upForm").classList.toggle("hidden", !on); $("upOpen").classList.toggle("hidden", on); if(on){ $("upStatus").textContent = ""; if(!$("upDate").value) $("upDate").value = today(); } }
  $("upOpen").addEventListener("click", function(){ showUpload(true); $("upFile").focus(); });
  $("upCancel").addEventListener("click", function(){ $("upForm").reset(); showUpload(false); });
  $("upFile").addEventListener("change", function(){
    // Guess the number from names like "05.2026_1.pdf" or "Fatura-07-2026.pdf".
    var f = this.files[0]; if(!f || $("upNumber").value) return;
    var m = f.name.match(/(\d{1,3})[._\- ](20\d{2})/);
    if(m) $("upNumber").value = "#" + m[1].padStart(2, "0") + "/" + m[2];
  });
  $("upForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = $("upFile").files[0];
    if(!f){ $("upStatus").textContent = "Zgjidh skedarin."; return; }
    var amount = cents($("upAmount").value);
    var data = new FormData();
    data.append("file", f); data.append("client", $("upClient").value); data.append("number", $("upNumber").value);
    data.append("date", $("upDate").value); data.append("amount", amount ? String(amount) : "");
    $("upSave").disabled = true; $("upStatus").textContent = "Duke ngarkuar…";
    fetch("/faturat?upload=1", { method: "POST", credentials: "same-origin", body: data })
      .then(function(r){ return r.json().then(function(b){ if(!r.ok) throw new Error(b.error || ""); return b; }); })
      .then(function(res){ setData(res); $("upForm").reset(); showUpload(false); })
      .catch(function(err){ $("upStatus").textContent = err.message || "Ngarkimi dështoi."; })
      .then(function(){ $("upSave").disabled = false; });
  });
  $("list").addEventListener("click", function(e){
    var id, inv;
    var edit = e.target.closest("[data-edit]");
    if(edit){ inv = invoices.find(function(x){ return x.id === edit.getAttribute("data-edit"); }); if(inv) openEditor(inv); return; }
    var del = e.target.closest("[data-del]");
    if(del){
      id = del.getAttribute("data-del"); inv = invoices.find(function(x){ return x.id === id; });
      if(!inv || !confirm("Ta fshij faturën " + inv.number + "?")) return;
      fetch("/faturat?id=" + encodeURIComponent(id), { method: "DELETE", credentials: "same-origin" }).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(setData).catch(function(){ alert("Fshirja dështoi."); });
      return;
    }
    var row = e.target.closest(".inv"); if(!row) return;
    inv = invoices.find(function(x){ return x.id === row.getAttribute("data-id"); }); if(inv) openModal(inv);
  });
  load();
})();
</script>
</body>
</html>`;
