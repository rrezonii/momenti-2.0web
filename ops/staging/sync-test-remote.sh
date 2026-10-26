#!/usr/bin/env bash
# Copies the "test" branch to /var/www/momenti-test. next dev reloads the pages by itself (no build).
set -uo pipefail
exec > >(tee /tmp/momenti-test-sync.log) 2>&1
TEST=/var/www/momenti-test
NAME=momenti-test
UPLOAD=/tmp/momenti-test-src.tar.gz
fail() { echo "XXX DESHTOI: $*"; exit 1; }
[ -d "$TEST/node_modules" ] || fail "testi nuk eshte konfiguruar ende (nis 'Test site: setup')"
[ -f "$UPLOAD" ] || fail "arkiva nuk u ngarkua"
STAGE=$(mktemp -d)
tar -xzf "$UPLOAD" -C "$STAGE" --no-same-owner || fail "arkiva eshte e demtuar"
OLD_CONFIG=$(sha256sum "$TEST/next.config.ts" 2>/dev/null | cut -d' ' -f1)
rsync -a --delete --exclude node_modules --exclude .env.local --exclude data --exclude '.next*' --exclude next-env.d.ts --exclude .lock-hash "$STAGE"/ "$TEST"/ || fail "kopjimi deshtoi"
rm -rf "$STAGE"
cd "$TEST" || fail "nuk u hap $TEST"
RESTART=0
NEW_LOCK=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ "$NEW_LOCK" != "$(cat .lock-hash 2>/dev/null)" ]; then
  echo "== Paketat ndryshuan: npm ci"
  npm ci --no-audit --no-fund >/tmp/momenti-test-npm.log 2>&1 || { tail -30 /tmp/momenti-test-npm.log; fail "npm ci deshtoi"; }
  echo "$NEW_LOCK" > .lock-hash
  RESTART=1
fi
[ "$OLD_CONFIG" = "$(sha256sum next.config.ts | cut -d' ' -f1)" ] || RESTART=1
if [ "$RESTART" -eq 1 ]; then pm2 restart "$NAME" --update-env >/dev/null && echo "== Testi u rinis"; fi
echo "=== GATI: ndryshimet jane ne test.momenti.info"
