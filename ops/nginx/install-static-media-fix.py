from datetime import datetime, timezone
from pathlib import Path
import shutil
import subprocess

config = Path('/etc/nginx/sites-available/momenti')
snippet = Path('/etc/nginx/snippets/momenti-static-media.conf')
shutil.copyfile('/var/www/momenti/ops/nginx/momenti-static-media.conf', snippet)
source = config.read_text()
include = '    include snippets/momenti-static-media.conf;'
if include not in source:
    anchor = '    server_name momenti.info www.momenti.info;'
    if source.count(anchor) < 1:
        raise RuntimeError('Expected Momenti server block was not found')
    backup = config.with_name('momenti.before-static-media-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S'))
    shutil.copy2(config, backup)
    config.write_text(source.replace(anchor, anchor + '\n' + include, 1))
    if subprocess.run(['nginx', '-t']).returncode:
        shutil.copy2(backup, config)
        raise RuntimeError('Nginx validation failed; configuration restored')
else:
    subprocess.run(['nginx', '-t'], check=True)
subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
