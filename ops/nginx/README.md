# Kosovo language routing on the VPS

KFL fonts use stable `/fonts/` URLs from `public/fonts`. The shared site CSS
can also emit `/static/media/` URLs when CSS is inlined. Install the matching
Nginx rewrite with `python3 ops/nginx/install-static-media-fix.py` on the VPS.
It backs up the site configuration, validates with `nginx -t`, and reloads
Nginx after validation. The rewrite forwards these URLs to `/_next/static/media/`.

Nginx uses the local DB-IP Lite country database, then forwards its country code
to Next.js in `X-Country-Code`. The Next.js proxy routes Kosovo (`XK`) visitors
to `/sq`; visitors elsewhere use their browser's supported language.

For a VPS build that leaves the active build folder untouched, build into the
release folder with `NEXT_BUILD_DIST_DIR=.next-release npm run build`. Keep the
same `NEXT_BUILD_DIST_DIR=.next-release` environment on the PM2 process when
restarting it.

## Install or refresh the monthly country database

Get the current `.mmdb.gz` URL and its MD5 checksum from the
[DB-IP Lite country download page](https://db-ip.com/db/download/ip-to-country-lite),
then run the checked installer as root with that month's `YYYY-MM` and checksum:

```sh
bash scripts/install-dbip-country-mmdb.sh YYYY-MM PUBLISHED_MD5_CHECKSUM
```

The installer downloads to a temporary directory, verifies the checksum, and
only then atomically installs `/usr/share/GeoIP/DBIP-Country.mmdb`. Nginx checks
for database changes every 24 hours.

## Nginx files

Run `bash scripts/configure-nginx-country-routing.sh` as root. The script backs
up existing Nginx files, adds the header snippet to all five Next.js proxy
locations, checks that all five are present, runs `nginx -t`, and reloads only
after the check succeeds.

The footer links to DB-IP to provide the attribution required by the Lite
database license.
