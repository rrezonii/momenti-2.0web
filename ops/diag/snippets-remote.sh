#!/usr/bin/env bash
for f in /etc/nginx/snippets/momenti-*.conf; do echo "=========== $f"; grep -vE "^\s*#|^\s*$" "$f"; done
echo "=========== static-media root"; ls /var/www/momenti/public | head -30
