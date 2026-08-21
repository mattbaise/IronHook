# IronHook API v1

This Flask API connects the IronHook Command Center to the PostgreSQL container-movement database.

Open `http://127.0.0.1:5001` after starting Flask to use the live Command Center.

## What this first version does

- Checks database health
- Lists and searches containers
- Returns one container with its movement history
- Returns live yard capacity
- Returns the active dispatch queue
- Starts an assignment with safety and hold checks
- Completes a move in one database transaction
- Records equipment operating time
- Pauses an assignment with a worker safety stop
- Creates audit records for important actions
- Displays a live browser-based Command Center

## Project files

- `app.py` starts Flask.
- `routes.py` contains the API routes and movement rules.
- `db.py` opens PostgreSQL connections.
- `validation.py` checks incoming values.
- `tests/test_validation.py` tests the validation rules.

## Setup

1. Create and activate a virtual environment.

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install the packages.

```bash
python -m pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and update `DATABASE_URL`.

4. Create the database tables and demo records from the parent folder.

```bash
psql "$DATABASE_URL" -f ../ironhook_container_schema_v1.sql
psql "$DATABASE_URL" -f ../ironhook_demo_data_v1.sql
```

5. Run the tests.

```bash
python -m pytest -v
```

6. Start the API.

```bash
python app.py
```

## Starter requests

Health check:

```bash
curl http://127.0.0.1:5000/api/health
```

List containers:

```bash
curl http://127.0.0.1:5000/api/containers
```

Find one container and its history:

```bash
curl http://127.0.0.1:5000/api/containers/MSCU1234567
```

See yard capacity:

```bash
curl http://127.0.0.1:5000/api/yard/capacity
```

See the current dispatch queue:

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

## Important v1 safety rules

- A customs or security hold blocks a move.
- Down or maintenance equipment blocks a move.
- Restricted equipment does not start through the normal endpoint.
- A safety stop pauses work immediately.
- Only the assigned worker can complete a move.
- The destination must be open, serviceable and unoccupied.
- Move completion, container placement, equipment hours and audit history update together. If one fails, the whole transaction rolls back.

Authentication, permissions and controlled-exception approval will be added before production use.
