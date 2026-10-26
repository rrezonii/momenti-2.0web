#!/usr/bin/env bash
# Removes the old KFL enhancers (RealESRGAN "E" and OpenAI "AI") from the VPS. Pruna stays.
set -uo pipefail
exec > >(tee /tmp/momenti-cleanup.log) 2>&1
APP=/var/www/momenti
STAMP=$(date +%Y%m%d-%H%M%S)
cd "$APP" || { echo "XXX nuk u gjet $APP"; exit 1; }

echo "== 1/5 Ku eshte enhancer-i (vetem informacion)"
url=$(grep -E '^KFL_ENHANCER_URL=' .env.local | head -1 | cut -d= -f2- | sed -E 's#^(https?://[^/]+).*#\1#')
echo "   KFL_ENHANCER_URL drejton te: ${url:-<bosh>}"
UNITS=$(systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | while read -r u; do
  if systemctl cat "$u" 2>/dev/null | grep -qiE 'kfl-enhancer|esrgan|worker\.py'; then echo "$u"; fi; done)
echo "   Sherbime systemd te enhancer-it: ${UNITS:-asnje}"
echo "   Procese:"; ps -eo pid,args | grep -iE 'kfl-enhancer|esrgan|worker\.py' | grep -v grep || echo "   asnje"

echo "== 2/5 Kopje rezerve -> /var/backups/momenti-old-enhancers-$STAMP.tar.gz"
mkdir -p /var/backups
install -m 600 .env.local "/var/backups/momenti-env-before-cleanup-$STAMP"
EXIST=(); for p in "app/(sq)/kycu/api/enhance" "app/(sq)/kycu/api/enhance-ai" "app/(sq)/kycu/api/enhance-chatgpt" "scripts/kfl-enhancer"; do [ -e "$p" ] && EXIST+=("$p"); done
if [ ${#EXIST[@]} -gt 0 ]; then tar -czf "/var/backups/momenti-old-enhancers-$STAMP.tar.gz" --exclude='*/weights' --exclude='__pycache__' "${EXIST[@]}"; fi

echo "== 3/5 Ndal sherbimet e enhancer-it"
for u in $UNITS; do
  systemctl stop "$u"; systemctl disable "$u" >/dev/null 2>&1
  f=$(systemctl show -p FragmentPath --value "$u"); echo "   u ndal dhe u çaktivizua: $u ($f)"
  case "$f" in /etc/systemd/system/*) rm -f "$f"; echo "   u fshi: $f";; esac
done
[ -n "$UNITS" ] && systemctl daemon-reload
pkill -f 'scripts/kfl-enhancer/worker\.py' 2>/dev/null && echo "   u ndal procesi worker.py" || true

echo "== 4/5 Fshij kodin, modelin dhe mjedisin Python"
for p in "app/(sq)/kycu/api/enhance" "app/(sq)/kycu/api/enhance-ai" "app/(sq)/kycu/api/enhance-chatgpt" "scripts/kfl-enhancer" ".kfl-esrgan-venv" ".kfl-enhancer-venv" ".kfl-tmp"; do
  if [ -e "$p" ]; then sz=$(du -sh "$p" 2>/dev/null | cut -f1); rm -rf -- "$p"; echo "   u fshi: $p ($sz)"; fi
done

echo "== 5/5 Hiq çelesat e vjeter nga .env.local"
for k in OPENAI_API_KEY KFL_ENHANCER_URL KFL_ENHANCER_TOKEN KFL_ENHANCER_PYTHON KFL_ENHANCER_THREADS KFL_ENHANCER_TILE; do
  if grep -qE "^$k=" .env.local; then sed -i "/^$k=/d" .env.local; echo "   u hoq: $k"; fi
done
grep -qE '^PRUNA_API_KEY=.+' .env.local && echo "   PRUNA_API_KEY mbetet ne vend" || echo "   !!! PRUNA_API_KEY mungon"
echo
echo "=== Pastrimi u krye. Kopja e .env.local: /var/backups/momenti-env-before-cleanup-$STAMP"
