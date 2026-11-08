"""Consistent SQLite deployment backup and isolated restore check; no data is printed."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile

REQUIRED_TABLES = {'User', 'Player', 'Activity', 'Payment', 'TreasuryTransaction', 'AccountingPeriod', 'Archive'}


def read_only(path):
    return sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True, timeout=30)


def table_counts(connection):
    tables = [row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    return {name: connection.execute('SELECT COUNT(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0] for name in tables}


def backup_database(source, destination):
    source = Path(source).resolve()
    destination = Path(destination).absolute()
    if not source.is_file() or source == destination.resolve():
        raise ValueError('An existing source database and a separate backup path are required')
    with read_only(source) as live:
        present = {row[0] for row in live.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not REQUIRED_TABLES <= present:
            raise ValueError('Database does not match the XD Prisma application; deployment stopped')
        destination.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        # Never overwrite an existing backup or a source file.
        descriptor = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(descriptor)
        with sqlite3.connect(destination) as snapshot:
            live.backup(snapshot, pages=256)
            if snapshot.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                raise ValueError('Backup integrity check failed')
            counts = table_counts(snapshot)
            schema = snapshot.execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").fetchall()
            with tempfile.TemporaryDirectory(prefix='xd-restore-', dir=destination.parent) as temporary:
                with sqlite3.connect(Path(temporary) / 'restored.sqlite') as restored:
                    snapshot.backup(restored)
                    if restored.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                        raise ValueError('Restore integrity check failed')
                    if table_counts(restored) != counts or restored.execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").fetchall() != schema:
                        raise ValueError('Restored schema or row counts differ')
    digest = hashlib.sha256()
    with destination.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    manifest = {'utc': datetime.now(timezone.utc).isoformat(), 'sha256': digest.hexdigest(), 'bytes': destination.stat().st_size, 'tables': counts, 'restore_verified': True}
    manifest_path = destination.with_suffix(destination.suffix + '.json')
    descriptor = os.open(manifest_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        json.dump(manifest, stream, indent=2)
        stream.write('\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('destination')
    args = parser.parse_args()
    os.umask(0o077)
    backup_database(args.source, args.destination)
    print('SQLite backup and isolated restore verification completed.')
