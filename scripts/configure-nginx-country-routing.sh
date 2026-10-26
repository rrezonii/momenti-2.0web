#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site_link="/etc/nginx/sites-enabled/momenti"
site="$(readlink -f "$site_link")"
geoip_config="/etc/nginx/conf.d/momenti-geoip2.conf"
header_snippet="/etc/nginx/snippets/momenti-country-header.conf"
temporary_site=""

restore_on_failure() {
  status=$?
  if [[ -n "$temporary_site" ]]; then
    rm -f "$temporary_site"
  fi
  if [[ "$status" -ne 0 ]]; then
    if [[ -e /var/backups/momenti-hotfix-20261020/momenti-geoip2.conf ]]; then
      cp -a /var/backups/momenti-hotfix-20261020/momenti-geoip2.conf "$geoip_config"
    else
      rm -f "$geoip_config"
    fi
    if [[ -e /var/backups/momenti-hotfix-20261020/momenti-country-header.conf ]]; then
      cp -a /var/backups/momenti-hotfix-20261020/momenti-country-header.conf "$header_snippet"
    else
      rm -f "$header_snippet"
    fi
    if [[ -e /var/backups/momenti-hotfix-20261020/momenti-vhost ]]; then
      cp -a /var/backups/momenti-hotfix-20261020/momenti-vhost "$site"
    fi
  fi
  exit "$status"
}
trap restore_on_failure EXIT

mkdir -p /etc/nginx/snippets
mkdir -p /var/backups/momenti-hotfix-20261020
for path in "$geoip_config" "$header_snippet"; do
  name="$(basename "$path")"
  if [[ -e "$path" && ! -e "/var/backups/momenti-hotfix-20261020/$name" ]]; then
    cp -a "$path" "/var/backups/momenti-hotfix-20261020/$name"
  fi
done
if [[ ! -e /var/backups/momenti-hotfix-20261020/momenti-vhost ]]; then
  cp -a "$site" /var/backups/momenti-hotfix-20261020/momenti-vhost
fi

install -o root -g root -m 0644 "$root/ops/nginx/momenti-geoip2.conf" "$geoip_config"
install -o root -g root -m 0644 "$root/ops/nginx/momenti-country-header.conf" "$header_snippet"

if ! grep -Fq 'include snippets/momenti-country-header.conf;' "$site"; then
  temporary_site="$(mktemp "${site}.XXXXXX")"
  if ! awk '
    {
      print
      if (index($0, "proxy_set_header X-Forwarded-Proto $scheme;")) {
        print "        include snippets/momenti-country-header.conf;"
        count++
      }
    }
    END { if (count != 5) exit 1 }
  ' "$site" > "$temporary_site"; then
    echo "Expected five Next.js proxy locations in $site; left the active file unchanged." >&2
    exit 1
  fi
  chmod --reference="$site" "$temporary_site"
  chown --reference="$site" "$temporary_site"
  mv -f "$temporary_site" "$site"
  temporary_site=""
fi

include_count="$(grep -Fc 'include snippets/momenti-country-header.conf;' "$site")"
if [[ "$include_count" -ne 5 ]]; then
  echo "Expected the country header in all five Next.js proxy locations; found $include_count." >&2
  exit 1
fi

nginx -t
systemctl reload nginx
echo "Nginx country lookup is configured and reloaded."
