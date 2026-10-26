#!/usr/bin/env bash
set -euo pipefail

month="${1:?Usage: install-dbip-country-mmdb.sh YYYY-MM EXPECTED_MD5}"
expected_md5="${2:?Provide the MD5 checksum published by DB-IP}"

if [[ ! "$month" =~ ^[0-9]{4}-[0-9]{2}$ || ! "$expected_md5" =~ ^[[:xdigit:]]{32}$ ]]; then
  echo "Invalid month or MD5 checksum." >&2
  exit 2
fi

url="https://download.db-ip.com/free/dbip-country-lite-${month}.mmdb.gz"
destination="/usr/share/GeoIP/DBIP-Country.mmdb"
temporary_directory="$(mktemp -d)"
staged_database=""
trap 'rm -rf "$temporary_directory"; [[ -z "$staged_database" ]] || rm -f "$staged_database"' EXIT

curl --fail --location --retry 3 "$url" -o "$temporary_directory/dbip-country.mmdb.gz"
gzip --decompress --stdout "$temporary_directory/dbip-country.mmdb.gz" > "$temporary_directory/DBIP-Country.mmdb"
printf '%s  %s\n' "$expected_md5" "$temporary_directory/DBIP-Country.mmdb" | md5sum --check --status
install -d -o root -g root -m 0755 "$(dirname "$destination")"
staged_database="$(mktemp "${destination}.XXXXXX")"
install -o root -g root -m 0644 "$temporary_directory/DBIP-Country.mmdb" "$staged_database"
mv -f "$staged_database" "$destination"
staged_database=""
echo "Installed verified DB-IP country database: $destination"
