# D1 restore drills

A monthly, automatic test that the newest backup in `sparkfare-backups` can be restored (workflow `d1-backup.yml`, job `drill`, the 2nd of each month). It imports the backup into the scratch database `sparkfare-restore-drill`, compares every table's row count with the counts taken just before the export (a table may differ by a few rows because writes land between the two; the tolerance is in `compareCounts` in `scripts/data/d1-backup.mjs`), then empties the scratch database. The workflow appends one row below; a FAIL also fails the job so GitHub emails the owner.

| Drill date | Backup date | Result | Notes |
| --- | --- | --- | --- |
| 2026-10-24 | 2026-10-24 | FAIL | first ever run: the Cloudflare API rejected the import into the just-created scratch database (a one-off; the log line was cleaned up afterwards). Passed on the rerun below. |
| 2026-10-24 | 2026-10-24 | PASS | 30 tables restored, counts within tolerance |
