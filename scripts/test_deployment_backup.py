from pathlib import Path
import sqlite3
import tempfile
import unittest
from deployment_backup import backup_database, REQUIRED_TABLES


class DeploymentBackup(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.source = Path(self.temporary.name) / 'live.sqlite'
        self.destination = Path(self.temporary.name) / 'backups' / 'before.sqlite'
        self.live = sqlite3.connect(self.source)
        self.addCleanup(self.live.close)
        self.live.execute('PRAGMA journal_mode=WAL')
        for name in REQUIRED_TABLES:
            self.live.execute(f'CREATE TABLE "{name}" (id INTEGER PRIMARY KEY, value TEXT)')
        self.live.execute('INSERT INTO "Player"(value) VALUES (?)', ('committed WAL record',))
        self.live.commit()

    def test_committed_wal_data_is_backed_up_and_restore_checked(self):
        manifest = backup_database(self.source, self.destination)
        self.assertTrue(manifest['restore_verified'])
        self.assertEqual(manifest['tables']['Player'], 1)
        with sqlite3.connect(self.destination) as snapshot:
            self.assertEqual(snapshot.execute('SELECT value FROM "Player"').fetchone()[0], 'committed WAL record')
        self.assertEqual(self.destination.stat().st_mode & 0o777, 0o600)

    def test_existing_backup_is_never_overwritten(self):
        backup_database(self.source, self.destination)
        original = self.destination.read_bytes()
        with self.assertRaises(FileExistsError):
            backup_database(self.source, self.destination)
        self.assertEqual(original, self.destination.read_bytes())

    def test_wrong_application_database_is_rejected(self):
        self.live.execute('DROP TABLE "Payment"')
        self.live.commit()
        with self.assertRaisesRegex(ValueError, 'does not match'):
            backup_database(self.source, self.destination)
        self.assertFalse(self.destination.exists())

    def test_source_cannot_be_its_own_backup(self):
        with self.assertRaises(ValueError):
            backup_database(self.source, self.source)


if __name__ == '__main__':
    unittest.main()
