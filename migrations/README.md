# IronHook migrations

Run `python manage.py migrate` after setting `DATABASE_URL`. The runner records each
file in `schema_migration` and never reapplies a successful migration.

The legacy v1 SQL files remain supported for existing installations. New databases
are installed in dependency order by `manage.py`.
