#!/usr/bin/env bash
# Momenti server cleanup. Usage: bash cleanup-server-remote.sh list|run
# Deletes ONLY: old full-site copies in /var/www (momenti-* / momenti.*), old .next-* builds
# (keeps the live build and the previous one), journal logs older than 7 days, npm download cache.
# Never touches: /var/www/momenti code, data (KFL drafts), .venv-argos, node_modules, .env.local,
# databases, WordPress, /var/backups, nginx.
set -uo pipefail
MODE="${1:-list}"
APP=/var/www/momenti
PM2_NAME=momenti
exec > >(tee "/tmp/momenti-cleanup-$MODE.log") 2>&1

[ -d "$APP" ] || { echo "XXX $APP nuk u gjet. Asgje nuk u fshi."; exit 1; }

# Every build dir any PM2 process points to (live), plus the newest other build (rollback).
REFERENCED=$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{for(const p of JSON.parse(s)){const e=p.pm2_env||{};const v=(e.env&&e.env.NEXT_BUILD_DIST_DIR)||e.NEXT_BUILD_DIST_DIR;if(v)console.log(v)}}catch{}})')
LIVE=$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const p=JSON.parse(s).find(x=>x.name===process.argv[1]);const e=(p&&p.pm2_env)||{};console.log((e.env&&e.env.NEXT_BUILD_DIST_DIR)||e.NEXT_BUILD_DIST_DIR||"")}catch{console.log("")}})' "$PM2_NAME")
if [ -z "$LIVE" ] || [ ! -d "$APP/$LIVE" ]; then
  echo "XXX Nuk u gjet build-i live nga PM2. Per siguri nuk fshihet asgje."; exit 1
fi
PREVIOUS=$(cd "$APP" && ls -dt .next-* 2>/dev/null | grep -vxF "$LIVE" | head -1)
NGINX_REFS=$(cat /etc/nginx/nginx.conf /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf 2>/dev/null)

TARGETS=()
TOTAL=0
add_target() {
  local path="$1" size
  size=$(du -sk "$path" 2>/dev/null | cut -f1); size=${size:-0}
  TARGETS+=("$path"); TOTAL=$((TOTAL + size))
  printf "   %8s  %s\n" "$(numfmt --to=iec $((size * 1024)))" "$path"
}

echo "== Build-i live (MBETET): $LIVE"
echo "== Build-i i meparshem per kthim (MBETET): ${PREVIOUS:-asnje}"
echo
echo "== 1) Kopje te vjetra te plota te faqes ne /var/www"
for dir in /var/www/momenti-* /var/www/momenti.*; do
  [ -d "$dir" ] || continue
  real=$(readlink -f "$dir")
  [ "$real" = "$(readlink -f "$APP")" ] && continue
  if grep -qF "$dir" <<<"$NGINX_REFS"; then echo "   (mbetet, nginx e perdor) $dir"; continue; fi
  add_target "$dir"
done

echo "== 2) Build-e te vjetra .next-* brenda $APP"
for dir in "$APP"/.next-*; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")
  [ "$name" = "$LIVE" ] && continue
  [ "$name" = "$PREVIOUS" ] && continue
  grep -qxF "$name" <<<"$REFERENCED" && { echo "   (mbetet, PM2 e perdor) $name"; continue; }
  add_target "$dir"
done

JOURNAL_NOW=$(journalctl --disk-usage 2>/dev/null | grep -o '[0-9.]*[KMG]B\?' | head -1)
NPM_CACHE=$(du -sh /root/.npm/_cacache 2>/dev/null | cut -f1)
echo "== 3) Log-et e sistemit (journal ${JOURNAL_NOW:-?}): mbahen vetem 7 ditet e fundit"
echo "== 4) Cache e shkarkimeve npm (${NPM_CACHE:-0}): rishkarkohet vete kur duhet"
echo
echo "== NUK preken: kodi i faqes, data/ (draftet KFL), .venv-argos (perkthimi), node_modules,"
echo "   .env.local, databaza WordPress/MySQL, /var/backups, nginx, /root/.cache"
echo "   /root/.cache (vetem informacion):"
du -sh /root/.cache/* 2>/dev/null | sort -rh | head -5 | sed 's/^/      /'
echo
echo "== Gjithsej lirohen rreth $(numfmt --to=iec $((TOTAL * 1024))) (+ log-et dhe cache npm)"

if [ "$MODE" != "run" ]; then
  echo; echo "(Kjo ishte vetem lista. Asgje nuk u fshi.)"; exit 0
fi

echo; echo "== Po fshij..."
for path in "${TARGETS[@]}"; do
  case "$path" in
    "$APP"|"$APP/"|"$APP/$LIVE"|/|/var/www|/var/www/) echo "   kapercehet (i mbrojtur): $path"; continue;;
  esac
  rm -rf --one-file-system -- "$path" && echo "   u fshi: $path"
done
journalctl --vacuum-time=7d >/dev/null 2>&1 && echo "   journal: u mbajten 7 ditet e fundit"
npm cache clean --force >/dev/null 2>&1 && echo "   cache npm: u pastrua"

echo
echo "== Kontroll i faqes"
code_kycu=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/kycu)
echo "   /kycu: $code_kycu · PM2: $(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="momenti");console.log(p?p.pm2_env.status:"?")})')"
echo "== Disku tani:"; df -h / | tail -1 | awk '{print "   Gjithsej "$2" · i zene "$3" ("$5") · i lire "$4}'
echo; echo "=== GATI: pastrimi u krye."
