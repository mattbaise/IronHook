# IronHook v3

IronHook is a beginner-friendly Flask and PostgreSQL training project for terminal container movements.

It includes two browser screens:

- **Command Center:** live yard capacity, equipment readiness, active dispatch and container tracking.
- **Operator:** a mobile-friendly longshoreman screen for starting assignments, completing moves and stopping work for safety.

The existing Command Center remains available at `/`. The operator screen uses the same assignment API and is available at `/operator`.

## Main files

- `app.py` starts Flask and serves both screens.
- `routes.py` contains the API routes and movement safety rules.
- `db.py` opens PostgreSQL connections.
- `validation.py` validates incoming values.
- `templates/command_center.html` is the Command Center.
- `templates/operator.html` is the mobile operator screen.
- `static/` contains the CSS and JavaScript for both screens.
- `tests/` contains the automated tests.

## Install on a Mac

Open Terminal and move into the project folder:

```bash
cd ~/Projects/IronHook-GitHub/ironhook-api
```

Create a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install the packages:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Create your local environment file:

```bash
cp .env.example .env
```

Open `.env` in VS Code and update `DATABASE_URL` with your PostgreSQL username, password, host, port and database name.

Example:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ironhook
FLASK_DEBUG=true
PORT=5000
```

## Create the database

PostgreSQL must be installed and running. From the IronHook project folder, run:

```bash
createdb ironhook
psql "$DATABASE_URL" -f ironhook_container_schema_v1.sql
psql "$DATABASE_URL" -f ironhook_demo_data_v1.sql
```

If the database already exists and already contains the IronHook tables, do not run the schema and demo files again.

## Run all tests

```bash
python -m pytest -v
```

The same complete test suite also runs automatically in GitHub Actions.

## Start IronHook

```bash
python app.py
```

Then open:

- Command Center: [http://127.0.0.1:5000](http://127.0.0.1:5000)
- Operator screen: [http://127.0.0.1:5000/operator](http://127.0.0.1:5000/operator)

If your `.env` uses a different `PORT`, replace `5000` in those addresses.

## Use the operator screen

1. Open `/operator` on a phone or computer.
2. Enter the worker ID assigned by dispatch. Demo worker Matthew Baise uses worker ID `1`.
3. Select **Start move** on a queued or assigned move.
4. Select **Complete move**, choose the confirmation method, enter operating minutes and add notes.
5. Select **Safety stop** whenever conditions are unsafe and describe the concern.

The worker ID is stored only in that browser on that device. The API still verifies assignment ownership and safety rules.

## Assignment API used by the operator screen

List active assignments:

```bash
curl http://127.0.0.1:5000/api/assignments
```

Start assignment 2 as worker 1:

```bash
curl -X POST http://127.0.0.1:5000/api/assignments/2/start \
  -H "Content-Type: application/json" \
  -d '{"worker_id": 1}'
```

Complete assignment 2:

```bash
curl -X POST http://127.0.0.1:5000/api/assignments/2/complete \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": 1,
    "confirmation_method": "SCAN",
    "operating_minutes": 14,
    "notes": "Container identity and destination confirmed"
  }'
```

Record a safety stop:

```bash
curl -X POST http://127.0.0.1:5000/api/assignments/2/safety-stop \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": 1,
    "reason": "Travel lane blocked by unsecured equipment"
  }'
```

## Safety rules preserved in v3

- Customs or security holds block moves.
- Down or maintenance equipment blocks moves.
- Restricted equipment cannot start through the normal endpoint.
- A safety stop pauses work immediately.
- Only the assigned worker can complete a move.
- The destination must be open, serviceable and unoccupied.
- Move completion, container placement, equipment hours and audit history update in one database transaction.

Authentication, production permissions and controlled-exception approval are still future production requirements.
