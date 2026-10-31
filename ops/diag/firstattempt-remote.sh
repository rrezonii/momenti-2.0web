#!/usr/bin/env bash
# Read-only: when did the password-guessing start, and when did the attacker's IP first appear.
A="/var/log/auth.log*"
cat_all() { for f in $(ls -tr /var/log/auth.log* 2>/dev/null); do case $f in *.gz) zcat $f;; *) cat $f;; esac; done; }
echo "== Log-et qe ekzistojne"; ls -la --time-style=+%F /var/log/auth.log* | awk '{print "   "$6" "$7}'
echo "   journal nga: $(journalctl --list-boots --no-pager 2>/dev/null | head -2 | tail -1 | awk '{print $4,$5}')"; journalctl -u ssh --no-pager -o short-iso 2>/dev/null | head -2 | tail -1 | cut -c1-25 | sed 's/^/   ssh journal i pari: /'
echo "== Serveri u instalua"; ls -la --time-style=+%F_%T /etc/hostname /var/log/installer 2>/dev/null | awk '{print "   "$6" "$7}'
echo "== Tentimi i pare i deshtuar (cfaredo IP)"; cat_all | grep -m1 -E "Failed password|Invalid user" | cut -c1-140 | sed 's/^/   /'
echo "== Tentime te deshtuara sipas dites"; cat_all | grep -E "Failed password|Invalid user" | awk '{print $1" "$2}' | uniq -c | sed 's/^/   /'
echo "== 154.16.112.232: hera e pare dhe sa tentime"; cat_all | grep "154.16.112.232" | head -3 | cut -c1-140 | sed 's/^/   /'; echo "   tentime: $(cat_all | grep -c '154.16.112.232')"
echo "   rrjeti 154.16.112.x: $(cat_all | grep -c '154\.16\.112\.')"
echo "== Hyrjet e suksesshme me fjalekalim (te gjitha)"; cat_all | grep "Accepted password" | cut -c1-120 | sed 's/^/   /'
echo "== Kur u vu fjalekalimi i root-it per here te fundit"; passwd -S root 2>/dev/null | sed 's/^/   /'; chage -l root 2>/dev/null | head -1 | sed 's/^/   /'
echo "== Top 10 IP qe provuan me shume"; cat_all | grep -oE "(Failed password|Invalid user).* from [0-9.]+" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$" | sort | uniq -c | sort -rn | head -10 | sed 's/^/   /'
echo "== Emrat e perdoruesve me te provuar"; cat_all | grep -oE "Invalid user [^ ]+" | awk '{print $3}' | sort | uniq -c | sort -rn | head -8 | sed 's/^/   /'; echo "   root: $(cat_all | grep -c 'Failed password for root')"
