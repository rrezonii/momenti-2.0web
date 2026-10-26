#!/usr/bin/env bash
# Momenti deploy: runs on the VPS. Live site stays on the old build until the new one is built and healthy.
set -uo pipefail
exec > >(tee /tmp/momenti-deploy.log) 2>&1
APP=/var/www/momenti
PM2_NAME=momenti
UPLOAD=/tmp/momenti-src.tar.gz
STAMP=$(date +%Y%m%d-%H%M%S)
STAGE=/tmp/momenti-stage-$STAMP
DIST=.next-pruna-toggle-$STAMP
BACKUP=/var/backups/momenti-src-$STAMP.tar.gz
fail() { echo; echo "XXX DESHTOI: $*"; echo "Site-i live NUK u ndryshua (perveç nese thuhet ndryshe me lart)."; exit 1; }

cd "$APP" || fail "nuk u gjet $APP"
OLD_DIST=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name===process.argv[1]);const e=(p&&p.pm2_env)||{};console.log((e.env&&e.env.NEXT_BUILD_DIST_DIR)||e.NEXT_BUILD_DIST_DIR||".next")})' "$PM2_NAME")
echo "== Build live aktual: $OLD_DIST"
grep -qE '^PRUNA_API_KEY=.+' .env.local || fail "PRUNA_API_KEY mungon ose eshte bosh ne $APP/.env.local"
[ -f "$UPLOAD" ] || fail "arkiva nuk u ngarkua"

echo "== 1/6 Hap arkiven"
mkdir -p "$STAGE" && tar -xzf "$UPLOAD" -C "$STAGE" --no-same-owner || fail "arkiva eshte e demtuar"

echo "== 2/6 Kontrolloj per ndryshime qe ekzistojne vetem ne server"
CONFLICTS=0; CHANGED=0
while IFS= read -r -d '' f; do
  rel=${f#"$STAGE"/}
  if [ -f "$APP/$rel" ]; then
    if ! cmp -s "$f" "$APP/$rel"; then
      if diff -q --strip-trailing-cr "$f" "$APP/$rel" >/dev/null 2>&1; then
        echo "   e njejte (vetem fund-rreshtash), e le si eshte: $rel"; rm -f "$f"; continue
      fi
      CHANGED=$((CHANGED+1)); echo "   ndryshon: $rel"
      if [ "$APP/$rel" -nt "$f" ]; then CONFLICTS=$((CONFLICTS+1)); echo "   !!! serveri ka version ME TE RI: $rel"; diff -u "$f" "$APP/$rel" | head -40; fi
    fi
  else
    CHANGED=$((CHANGED+1)); echo "   i ri: $rel"
  fi
done < <(find "$STAGE" -type f -print0)
find "$STAGE" -type f -name "*.cmp-skip" -delete 2>/dev/null
echo "   Gjithsej skedare te ndryshuar/te rinj: $CHANGED"
[ "$CONFLICTS" -eq 0 ] || fail "$CONFLICTS skedare jane me te rinj ne server se ne PC. Nuk i mbishkruaj pa i pare."
[ "$CHANGED" -gt 0 ] || fail "asgje per te derguar - kodi ne server eshte i njejte"

echo "== 3/6 Kopje rezerve e kodit aktual -> $BACKUP"
mkdir -p /var/backups
LIST=/tmp/momenti-backup-list-$STAMP.txt; : > "$LIST"
while IFS= read -r -d '' f; do rel=${f#"$STAGE"/}; [ -f "$APP/$rel" ] && printf '%s\n' "$rel" >> "$LIST"; done < <(find "$STAGE" -type f -print0)
echo "   $(wc -l < "$LIST") skedare ekzistues ruhen ne kopje"
tar -czf "$BACKUP" -C "$APP" -T "$LIST" || fail "kopja rezerve deshtoi"
restore_src() { echo "   Rikthej kodin e vjeter..."; tar -xzf "$BACKUP" -C "$APP"; }

echo "== 4/6 Vendos kodin e ri"
cp -a "$STAGE"/. "$APP"/ || { restore_src; fail "kopjimi deshtoi"; }
node -e "require('sharp')" 2>/dev/null || { restore_src; fail "paketa 'sharp' mungon ne server (Pruna e kerkon)"; }

echo "== 5/6 Build ne $DIST (zgjat disa minuta)..."
# Each old build folder adds its own types to tsconfig "include"; those can point at
# routes that no longer exist and fail the type check. Next re-adds the new build's own.
cp tsconfig.json "/tmp/momenti-tsconfig-$STAMP.json"
node -e '
const fs = require("fs"); const c = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
const before = c.include.length;
c.include = c.include.filter((p) => !/^\.next-[^/]+\/(dev\/)?types\//.test(p));
fs.writeFileSync("tsconfig.json", JSON.stringify(c, null, 2) + "\n");
console.log("   tsconfig: u hoqen " + (before - c.include.length) + " referenca te build-eve te vjetra");
' || fail "tsconfig.json nuk u lexua"
if ! NEXT_BUILD_DIST_DIR="$DIST" npm run build; then
  cp "/tmp/momenti-tsconfig-$STAMP.json" tsconfig.json
  restore_src; rm -rf "$DIST"; fail "build-i deshtoi; kodi i vjeter u rikthye"
fi

echo "== 6/6 Rinis PM2 me build-in e ri"
NEXT_BUILD_DIST_DIR="$DIST" pm2 restart "$PM2_NAME" --update-env >/dev/null
OK=0
for i in $(seq 1 30); do
  sleep 2
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/kycu || true)
  case "$code" in 200|30[1278]) OK=1; break;; esac
done
if [ "$OK" -ne 1 ]; then
  echo "   Faqja nuk u pergjigj ($code). Kthej build-in e vjeter $OLD_DIST"
  NEXT_BUILD_DIST_DIR="$OLD_DIST" pm2 restart "$PM2_NAME" --update-env >/dev/null
  restore_src
  fail "build-i i ri nuk u nis; site-i u kthye ne versionin e meparshem"
fi
pm2 save >/dev/null
home=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)
echo
echo "=== GATI: live tani eshte $DIST (kycu: $code, ballina: $home)"
echo "Per kthim mbrapa: NEXT_BUILD_DIST_DIR=$OLD_DIST pm2 restart $PM2_NAME --update-env"
rm -rf "$STAGE" "$UPLOAD"
