# D1 Migrations (IMPORTANT)

**Migrations in this repository are NOT auto-applied during deploy.** 

There is currently no GitHub Actions step that runs `wrangler d1 migrations apply` on merge to `main`. When you add a new migration file here, you MUST manually run the following command to apply it to production:

```bash
wrangler d1 execute sparkfare-db --remote --file=<your_migration_file.sql>
```

Alternatively, to apply all unapplied migrations:
```bash
wrangler d1 migrations apply sparkfare-db --remote
```

Failure to do so will result in 500 errors if the code expects a new schema/data that hasn't been created yet.
