#!/usr/bin/env bash
set -euo pipefail

cron_entry='*/5 * * * * set -a; . /var/www/momenti/.env.translation; set +a; cd /var/www/momenti && node scripts/process-translations.mjs recent >> /var/log/momenti-translation-recent.log 2>&1'
existing_crontab="$(crontab -l 2>/dev/null || true)"

if ! printf '%s\n' "$existing_crontab" | grep -Fqx -- "$cron_entry"; then
  {
    printf '%s\n' "$existing_crontab"
    printf '%s\n' "$cron_entry"
  } | crontab -
fi

if ! systemctl is-active --quiet cron 2>/dev/null; then
  systemctl enable --now cron 2>/dev/null || service cron start
fi
