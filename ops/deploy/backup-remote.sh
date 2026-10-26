#!/usr/bin/env bash
# Full backup of the live Momenti site (Next.js + KFL) on the VPS. Read-only for the site itself.
set -uo pipefail
exec > >(tee /tmp/momenti-backup.log) 2>&1
APP=/var/www/momenti
STAMP=$(date +%Y%m%d-%H%M%S)
NAME=momenti-full-$STAMP
OUT=/var/backups/$NAME.tar.gz
META=/tmp/$NAME-meta
mkdir -p /var/backups "$META"
cd "$APP" || { echo "XXX nuk u gjet $APP"; exit 1; }

pm2 save >/dev/null 2>&1
LIVE=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="momenti");const e=(p&&p.pm2_env)||{};console.log((e.env&&e.env.NEXT_BUILD_DIST_DIR)||e.NEXT_BUILD_DIST_DIR||".next")})')
echo "== Build live: $LIVE"

# Info + restore notes inside the archive
{
  echo "Momenti full backup $STAMP"
  echo "Live build: $LIVE"; echo "Node: $(node -v)  npm: $(npm -v)"; echo
  pm2 list --no-color; echo
  echo "crontab:"; crontab -l 2>/dev/null || echo "(bosh)"
} > "$META/INFO.txt"
crontab -l > "$META/crontab.txt" 2>/dev/null || true
cat > "$META/RESTORE.txt" <<TXT
Rikthimi (ne nje VPS te ri ose te njejtin):
1. tar -xzf $NAME.tar.gz -C /            (rikthen /var/www/momenti, /etc/nginx, pm2 dump)
2. cd /var/www/momenti && npm ci          (node_modules nuk ruhen ne backup)
3. Build-i live ($LIVE) eshte ne arkive; per ta nisur:
   NEXT_BUILD_DIST_DIR=$LIVE pm2 start npm --name momenti -- start && pm2 save
   (ose: pm2 resurrect, qe perdor dump.pm2 nga arkiva)
4. nginx -t && systemctl reload nginx
5. crontab /var/www/momenti/_backup-info/crontab.txt   (rikthen detyrat e planifikuara)
Kujdes: arkiva permban .env.local me te gjithe celesat sekrete.
TXT

# What to include from the app folder: everything except reproducible/heavy parts.
ENTRIES=()
while IFS= read -r -d '' e; do
  b=${e#./}
  case "$b" in node_modules|.venv-argos|.next|.next-*) continue;; esac
  ENTRIES+=("var/www/momenti/$b")
done < <(find . -mindepth 1 -maxdepth 1 -print0)
[ -d "$LIVE" ] && ENTRIES+=("var/www/momenti/$LIVE")

EXTRA=()
for p in etc/nginx root/.pm2/dump.pm2 etc/momenti-translation.env etc/letsencrypt/renewal; do [ -e "/$p" ] && EXTRA+=("$p"); done

echo "== Paketoj (kod, KFL drafts, public, .env, build live, nginx, pm2)..."
tar -czf "$OUT" \
  -C / "${ENTRIES[@]}" "${EXTRA[@]}" \
  --transform "s#^tmp/$NAME-meta#var/www/momenti/_backup-info#" -C / "tmp/$NAME-meta" 2>/tmp/momenti-backup-tar.err
rc=$?
if [ $rc -gt 1 ]; then cat /tmp/momenti-backup-tar.err; echo "XXX backup deshtoi"; exit 1; fi
rm -rf "$META"

echo "== Permbajtja:"
for d in app components lib public data/kfl-drafts scripts ops "$LIVE" .env.local; do
  n=$(tar -tzf "$OUT" | grep -c "^var/www/momenti/$d" || true); echo "   $d: $n skedare"
done
echo "   nginx: $(tar -tzf "$OUT" | grep -c '^etc/nginx' || true) skedare"
echo "== Madhesia: $(du -h "$OUT" | cut -f1)"
echo "SHA256 $(sha256sum "$OUT" | cut -d' ' -f1)"

echo "== WordPress (artikujt)"
WPDIR=$(dirname "$(find /var/www -maxdepth 3 -name wp-config.php 2>/dev/null | head -1)")
WPOUT=""; WPFILES=""
if [ -f "$WPDIR/wp-config.php" ]; then
  wpval() { sed -n "s/.*define( *['\"]$1['\"] *, *['\"]\([^'\"]*\)['\"].*/\1/p" "$WPDIR/wp-config.php" | head -1; }
  DBN=$(wpval DB_NAME); DBU=$(wpval DB_USER); DBP=$(wpval DB_PASSWORD); DBH=$(wpval DB_HOST)
  CNF=$(mktemp); chmod 600 "$CNF"
  printf '[client]\nuser=%s\npassword=%s\nhost=%s\n' "$DBU" "$DBP" "${DBH:-localhost}" > "$CNF"
  WPOUT=/var/backups/momenti-cms-db-$STAMP.sql.gz
  if mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines --triggers "$DBN" 2>/tmp/momenti-wpdump.err | gzip > "$WPOUT" && [ "$(gzip -cd "$WPOUT" | head -c 200 | wc -c)" -gt 0 ]; then
    echo "   Databaza '$DBN': $(du -h "$WPOUT" | cut -f1) (te gjithe artikujt, kategorite, perdoruesit)"
  else
    echo "   !!! dump i databazes deshtoi: $(head -c 300 /tmp/momenti-wpdump.err)"; rm -f "$WPOUT"; WPOUT=""
  fi
  rm -f "$CNF"
  WPFILES=/var/backups/momenti-cms-files-$STAMP.tar.gz
  tar -czf "$WPFILES" --exclude='*/cache/*' --exclude='*/upgrade/*' -C "$(dirname "$WPDIR")" "$(basename "$WPDIR")" 2>/dev/null
  echo "   Skedaret e WordPress (fotot e artikujve, tema, plugin-et): $(du -h "$WPFILES" | cut -f1)"
fi

echo "== Informacion shtese (jo ne backup):"
echo "   WordPress (artikujt): $(grep -E '^WORDPRESS_URL=' .env.local | cut -d= -f2-)"
wp=$(find /var/www -maxdepth 3 -name wp-config.php 2>/dev/null | head -3); echo "   wp-config ne kete VPS: ${wp:-asnje}"
echo "   Redis: $(grep -qE '^REDIS_URL=' .env.local && echo 'perdoret (numri i shikimeve)' || echo 'jo')"
echo "BACKUP_FILE $OUT"
{ echo "$OUT"; [ -n "$WPOUT" ] && echo "$WPOUT"; [ -n "$WPFILES" ] && echo "$WPFILES"; } > /tmp/momenti-backup-files.txt
