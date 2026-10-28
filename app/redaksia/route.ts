import { LOGO } from "@/lib/invoices/assets";
import { checkLogin, clearSessionCookie, hasSession, isRedaksiaHost, sessionCookie } from "@/lib/redaksia/session";

// Newsroom portal: redaksia.momenti.info/ (nginx serves this route at "/").
// Login screen, then two tiles: Faturat and Kalkulatori.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const attempts = new Map<string, { count: number; until: number }>();
const NEXT_ALLOWED = ["/faturat", "/calculator"];

function home(request: Request) { return isRedaksiaHost(request) ? "/" : "/redaksia"; }
function clientIp(request: Request) { return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local"; }
const esc = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const html = (body: string, status = 200, extra: Record<string, string> = {}) => new Response(body, { status, headers: {
  "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", ...extra } });

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has("logout")) {
    return new Response(null, { status: 303, headers: { Location: home(request), "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
  }
  if (!hasSession(request)) return html(page(loginBody(url.searchParams.get("next") ?? "", "")));
  return html(page(portalBody(home(request))));
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.until > now && entry.count >= 8) {
    return html(page(loginBody("", "Shumë tentime. Provo përsëri pas 15 minutash.")), 429);
  }
  const form = await request.formData().catch(() => null);
  const username = String(form?.get("username") ?? "");
  const password = String(form?.get("password") ?? "");
  const next = String(form?.get("next") ?? "");
  if (!checkLogin(username, password)) {
    attempts.set(ip, { count: (entry && entry.until > now ? entry.count : 0) + 1, until: now + 15 * 60_000 });
    return html(page(loginBody(next, "Emri i përdoruesit ose fjalëkalimi nuk është i saktë.", username)), 401);
  }
  attempts.delete(ip);
  const target = NEXT_ALLOWED.includes(next) ? next : home(request);
  return new Response(null, { status: 303, headers: { Location: target, "Set-Cookie": sessionCookie(), "Cache-Control": "no-store" } });
}

function loginBody(next: string, error: string, username = "") {
  return `<main class="login">
  <img class="logo" src="${LOGO}" alt="Momenti">
  <form method="post" class="card" autocomplete="on">
    <h1>Redaksia</h1>
    <p class="sub">Hyr për të vazhduar te faturat dhe kalkulatori.</p>
    ${error ? `<div class="error" role="alert">${esc(error)}</div>` : ""}
    <label>Përdoruesi<input name="username" autocomplete="username" value="${esc(username)}" required autofocus></label>
    <label>Fjalëkalimi<span class="pw"><input name="password" id="pw" type="password" autocomplete="current-password" required><button type="button" id="show" aria-label="Shfaq fjalëkalimin">Shfaq</button></span></label>
    <input type="hidden" name="next" value="${esc(NEXT_ALLOWED.includes(next) ? next : "")}">
    <button class="btn" type="submit">Hyr</button>
  </form>
  <p class="foot">Momenti Media SH.P.K · vetëm për redaksinë</p>
</main>
<script>document.getElementById("show").addEventListener("click",function(){var p=document.getElementById("pw");var on=p.type==="password";p.type=on?"text":"password";this.textContent=on?"Fshih":"Shfaq";});</script>`;
}

function portalBody(homePath: string) {
  const logout = `${homePath === "/" ? "/" : "/redaksia"}?logout=1`;
  return `<main class="portal">
  <header class="bar"><img class="logo small" src="${LOGO}" alt="Momenti"><div class="who"><span>REDAKSIA</span><a href="${logout}">Dil</a></div></header>
  <h1>Mirë se erdhe</h1>
  <p class="sub">Zgjidh ku do të punosh sot.</p>
  <div class="tiles">
    <a class="tile" href="/faturat">
      <span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h9l4 4V21.2l-2.2-1.4-2.2 1.4-2.2-1.4-2.2 1.4-2.2-1.4L5.8 21.2V3a.2.2 0 0 1 .2-.2Z"/><path d="M15 2.8V7h4"/><path d="M9 10.5h6M9 13.5h6M9 16.5h3.5"/></svg></span>
      <b>Faturat</b><small>Krijo, edito dhe ruaj faturat e klientëve. Shkarko PDF.</small><em>Hap →</em>
    </a>
    <a class="tile" href="/calculator">
      <span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="2.8" width="15" height="18.4" rx="2.4"/><rect x="7.5" y="5.8" width="9" height="4" rx=".8"/><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17.2h.01M12 17.2h.01M16 17.2h.01"/></svg></span>
      <b>Kalkulatori</b><small>Ndarja Dukagjini · Airtiketa · Momenti, me drafte dhe PDF.</small><em>Hap →</em>
    </a>
  </div>
</main>`;
}

function page(body: string) {
  return `<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#2c0b11">
<title>Redaksia · Momenti</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--red:#9b0019;--navy:#0f1c3f;--paper:#fbfaf6;--muted:#6b6f80;--line:#e3dccf}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:Outfit,Segoe UI,Arial,sans-serif;color:var(--navy);
  background:radial-gradient(70% 55% at 100% 0%,rgba(161,40,58,.45),transparent 65%),radial-gradient(60% 50% at 0% 100%,rgba(161,40,58,.22),transparent 70%),linear-gradient(180deg,#34101a,#22070d);padding:24px 16px}
a{color:inherit}
.logo{display:block;width:220px;height:auto;margin:6vh auto 26px}
.logo.small{width:120px;margin:0}
.login{max-width:400px;margin:0 auto}
.card{background:var(--paper);border-radius:22px;padding:30px 26px;box-shadow:0 30px 60px rgba(10,1,3,.45)}
.card h1{margin:0;font-size:30px;font-weight:800;color:var(--red)}
.sub{margin:4px 0 22px;color:var(--muted);font-size:15px}
label{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.05em;text-transform:uppercase;margin-bottom:16px}
input{font:inherit;font-size:17px;font-weight:600;color:var(--navy);padding:13px 14px;border:1.5px solid var(--line);border-radius:12px;background:#fff;outline:none;width:100%;text-transform:none;letter-spacing:0}
input:focus{border-color:var(--navy);box-shadow:0 0 0 3px rgba(15,28,63,.1)}
.pw{position:relative;display:block}
.pw button{position:absolute;right:8px;top:50%;transform:translateY(-50%);font:inherit;font-size:13px;font-weight:700;color:var(--muted);background:none;border:0;cursor:pointer;padding:6px}
.btn{width:100%;font:inherit;font-size:17px;font-weight:800;border:0;border-radius:12px;padding:14px;background:linear-gradient(135deg,#a3192e,#6d1b27);color:#fff;cursor:pointer;margin-top:6px}
.btn:hover{filter:brightness(1.08)}
.error{background:#fdecee;color:#9b0019;border-radius:10px;padding:10px 12px;font-size:14px;font-weight:600;margin-bottom:14px}
.foot{text-align:center;color:#d9c3c0;font-size:12.5px;margin-top:18px}
.portal{max-width:900px;margin:0 auto}
.bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:8vh}
.who{display:flex;align-items:center;gap:14px;color:#ffb4bb;font-size:13px;font-weight:700;letter-spacing:.08em}
.who a{color:#fff4ef;text-decoration:none;border:1.5px solid rgba(255,214,219,.35);border-radius:999px;padding:6px 14px;letter-spacing:0}
.who a:hover{border-color:#ffb4bb}
.portal h1{margin:0;color:#fff4ef;font-size:38px;font-weight:800}
.portal .sub{color:#d9c3c0;margin-bottom:28px}
.tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.tile{display:flex;flex-direction:column;gap:8px;text-decoration:none;background:var(--paper);border-radius:22px;padding:28px 26px;min-height:230px;box-shadow:0 24px 50px rgba(10,1,3,.4);border:2px solid transparent;transition:transform .15s ease,border-color .15s ease}
.tile:hover{transform:translateY(-3px);border-color:#c9a2a7}
.tile .icon{width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:#f6e6e8;color:var(--red);margin-bottom:8px}
.tile svg{width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.tile b{font-size:26px;font-weight:800}
.tile small{color:var(--muted);font-size:15px;line-height:1.4}
.tile em{margin-top:auto;font-style:normal;font-weight:800;color:var(--red)}
@media (max-width:640px){.tiles{grid-template-columns:1fr}.tile{min-height:170px}.portal h1{font-size:30px}.bar{margin-bottom:5vh}}
</style>
</head>
<body>
${body}
</body>
</html>`;
}
