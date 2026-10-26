#!/usr/bin/env bash
set -uo pipefail

cd /var/www/momenti || exit 1
set -a
. /var/www/momenti/.env.translation
set +a

node scripts/process-translations.mjs archive
translation_status=$?
if [ "$translation_status" -ne 0 ]; then
  echo "Archive translation stopped with exit code $translation_status; automatic redirects remain disabled."
  exit "$translation_status"
fi

bash scripts/setup-translation-cron.sh || exit 1

sed -i 's/^ENGLISH_EDITION_READY=.*/ENGLISH_EDITION_READY=true/' /var/www/momenti/.env.local
pm2 restart momenti --update-env || exit 1
pm2 save || exit 1
echo "Archive translation finished; future translations are scheduled and browser-language redirects are enabled."
