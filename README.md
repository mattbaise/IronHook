# IronHook Integrated Platform

IronHook by BaiseLine is a longshoreman-first terminal operations platform built
with Flask, PostgreSQL, Jinja, HTML, CSS and JavaScript. The integrated feature
branch connects Command Center operations, the mobile Operator/My IronHook
portal, configurable multi-terminal yards, cargo security and administration.

## Platform areas

- `/` — authenticated Command Center with live capacity, dispatch, equipment,
  container tracking and navigation to all operational views.
- `/demo` — the original vessel visualization, preserved unchanged.
- `/demo/yard` — the matching yard visualization plus a database-driven client
  layout for terminals, zones, blocks, rows, bays, tiers, capacities and rules.
- `/operator` — Operator dispatch actions and My IronHook profile, hours, pay,
  credentials, certifications, documents, schedule, gang and shift history.
- `/security` — risk assessment, random/risk inspection selection, holds,
  findings, custody transfers, seal/location records, disposition and audit trail.
- `/admin` — terminal policies, yard configuration, users and role access.

Roles are `OPERATOR`, `SUPERVISOR`, `DISPATCHER`, `SECURITY`, `HR_PAYROLL` and
`ADMIN`. Operator actions are bound to the signed-in worker identity; protected
pages and APIs enforce role checks. Login attempts, lockouts and logouts are
audited. Secure cookie settings, same-origin write checks, payload limits and
browser security headers are enabled.

## Local setup

Requires Python 3.12+ and PostgreSQL.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
```

Set a real `DATABASE_URL`, a long random `SECRET_KEY`, and the existing
credential-signing setting required by the QR workflow.

Create and migrate the database:

```bash
createdb ironhook
python manage.py migrate
python manage.py seed-demo
```

`manage.py migrate` applies the existing v1 database files and the integrated
platform migration in dependency order, recording completed files in
`schema_migration`. `seed-demo` is repeatable and creates configurable yard,
worker self-service and role-based demo records.

Demo usernames are `operator`, `supervisor`, `dispatcher`, `security`, `payroll`
and `admin`. Their local demo password is `IronHookDemo!2026`. Never use this
password outside local demonstration data.

## Run and verify

```bash
python -m pytest -q
python app.py
```

Open [http://127.0.0.1:5000/login](http://127.0.0.1:5000/login). If `PORT` is
changed in `.env`, use that port instead.

## Operational safety rules

- Customs or security holds block container movement.
- Down or maintenance equipment blocks normal moves.
- Restricted equipment requires an authorized credential scan.
- Only the signed-in assigned operator can act on an operator assignment.
- Safety stop remains available during actionable assignment states.
- Completion validates destination availability and commits the move, container,
  equipment and audit updates in one database transaction.
- Inspection clearance removes only the security hold and records who cleared it.
- Sensitive worker and payroll APIs are self-service or role-restricted and use
  no-store browser caching.

## Important files

- `app.py` — application factory, pages and HTTP security controls.
- `auth.py` — sessions, login lockout, audit logging and RBAC decorators.
- `routes.py` — container, yard, workforce, credential and movement APIs.
- `worker_portal.py` — worker-scoped My IronHook APIs.
- `terminal_admin.py` — terminal, yard and user administration APIs.
- `security_operations.py` — cargo risk and inspection workflows.
- `manage.py`, `migrations/` — ordered database migration runner.
- `scripts/seed_integrated_demo.py` — repeatable integrated demo data.
- `tests/` — validation, authentication, RBAC, UI contract and security tests.

This branch must be reviewed and tested before promotion. It is intentionally not
merged into `ironhook-v2` or `main`.
