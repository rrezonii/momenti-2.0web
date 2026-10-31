#!/usr/bin/env bash
pm2 ls | sed "s/^/   /"
echo "== log momenti-test"; tail -n 40 /root/.pm2/logs/momenti-test-out.log | cut -c1-200; tail -n 25 /root/.pm2/logs/momenti-test-error.log | cut -c1-200
echo "== curl"; for i in 1 2 3 4 5 6; do c=$(curl -s -m 60 -o /dev/null -w "%{http_code} %{time_total}s" http://127.0.0.1:3100/kycu); echo "   $c"; case "$c" in 200*|307*) break;; esac; sleep 10; done
grep "\"version\"" /var/www/momenti-test/node_modules/next/package.json
