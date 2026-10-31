#!/usr/bin/env bash
# Prints the public SSH keys (public, safe to show) for the reinstall form.
grep -E "github-actions-deploy|gent@DESKTOP" /root/.ssh/authorized_keys
