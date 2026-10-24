# D1 restore drills

A monthly, automatic test that the newest backup in `sparkfare-backups` can be restored (workflow `d1-backup.yml`, job `drill`, the 2nd of each month). It imports the backup into the scratch database `sparkfare-restore-drill`, compares every table's row count with the counts taken just before the export (a table may differ by a few rows because writes land between the two; the tolerance is in `compareCounts` in `scripts/data/d1-backup.mjs`), then empties the scratch database. The workflow appends one row below; a FAIL also fails the job so GitHub emails the owner.

| Drill date | Backup date | Result | Notes |
| --- | --- | --- | --- |
| 2026-10-24 | 2026-10-24 | FAIL | missing: none; off: none; import failed (exit 1): [33m▲ [43;33m[[43;30mWARNING[43;33m][0m [1m⚠️ This process may take some time, during which your D1 database will be unavailable to serve queries.[0m


[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mA request to the Cloudflare API (/accounts/ad13089e5556c73ee5ee104940674249/d1/database/6eabf4 |
| 2026-10-24 | 2026-10-24 | PASS | 30 tables restored, counts within tolerance |
