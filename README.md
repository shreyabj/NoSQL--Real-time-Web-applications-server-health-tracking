# Real-Time Web Application Server Health Monitoring Using MongoDB

A Docker-only mini-project: React + Vite dashboard, Node.js + Express API, and MongoDB 7.0, all running in Docker Compose.
**Nothing except Docker Desktop is needed on the host.** No local MongoDB, mongosh, Compass, Node.js or npm.

| Service    | Container name           | Image / build          | Host URL                   |
|------------|--------------------------|------------------------|----------------------------|
| `frontend` | `server-health-frontend` | `./frontend` (nginx)   | http://localhost:3000      |
| `backend`  | `server-health-backend`  | `./backend` (Node 20)  | http://localhost:5000/api  |
| `mongodb`  | `server-health-mongodb`  | `mongo:7.0`            | not published (Docker network only) |

- Database: `server_health_monitoring`. Collections: `input` and `result` (no others).
- Backend connects with `MONGODB_URI=mongodb://mongodb:27017/server_health_monitoring` (hostname `mongodb` on the Compose network `health-net`).
- Data lives in the named volume `server-health-monitoring_mongodb_data`.

## Project structure

```
NoSQL OEE/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── input_schema.py            (supplied reference)
├── output_schema.py           (supplied reference)
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
│       ├── server.js          Express app + all API routes + startup/auto-seed
│       ├── config.js          environment configuration
│       ├── db.js              MongoDB connection (retry), collections, indexes, $jsonSchema validator
│       ├── aggregation.js     $match/$unwind/$group/$set/$project/$merge pipeline
│       ├── seedData.js        deterministic 12 documents / 36 readings
│       ├── servers.js         metadata for Server-01..03
│       └── validation.js      validation for new readings
└── frontend/
    ├── Dockerfile             multi-stage: Vite build -> nginx
    ├── .dockerignore
    ├── nginx.conf             serves the app, proxies /api -> backend:5000
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx, App.jsx, api.js, styles.css
        └── components/ StatCards, ServerCard, StatusBadge, ResultsTable, InputTable, ReadingForm
```

## 1. Start Docker Desktop

Open **Docker Desktop** from the Start menu and wait until it shows "Engine running". Or start it from PowerShell:

```powershell
Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
# (default all-users install path: "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe")
docker info --format '{{.ServerVersion}}'   # prints a version once the engine is ready
```

## 2. Build and start the application

```powershell
cd "$env:USERPROFILE\Desktop\NoSQL OEE"
Copy-Item .env.example .env        # optional; defaults are built into docker-compose.yml
docker compose up --build -d
docker compose ps
```

Compose waits for the MongoDB health check (`mongosh ... ping`) before starting the backend, and for the backend health check (`/api/health`) before starting the frontend. All three should show `Up`, with mongodb and backend shown as `(healthy)`.

## 3. Seed the initial sample data

When the `input` collection is empty, the backend seeds it automatically on startup (`AUTO_SEED=true`). Seeding manually is safe too. It is idempotent: the 12 sample documents are upserted by `report_id`, so you never get duplicates.

```powershell
$ProgressPreference = 'SilentlyContinue'   # hides PowerShell 5.1 progress-bar noise
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/seed -ContentType 'application/json' -Body '{}'
```

Expected: `input_document_count = 12`, `reading_count = 36`, and 3 result documents (1 healthy, 2 unhealthy).

## 4. Open the dashboard

```powershell
Start-Process http://localhost:3000
```

## 5. Inspect MongoDB through `docker exec` (mongosh inside the container)

Interactive shell:

```powershell
docker exec -it server-health-mongodb mongosh
```

Then type:

```javascript
use server_health_monitoring
show collections
db.input.countDocuments()
db.result.countDocuments()
db.input.find().pretty()
db.result.find().pretty()
db.input.aggregate([{ $unwind: "$readings" }, { $count: "total_readings" }])
db.result.find({}, { _id: 0, server_name: 1, avg_metric_value: 1, min_metric_value: 1, max_metric_value: 1, health_status: 1, error_reason: 1 })
exit
```

One-line PowerShell commands (no interactive shell):

```powershell
docker exec -it server-health-mongodb mongosh server_health_monitoring --eval "db.getCollectionNames()"
docker exec -it server-health-mongodb mongosh server_health_monitoring --eval "db.input.countDocuments()"
docker exec -it server-health-mongodb mongosh server_health_monitoring --eval "db.result.countDocuments()"
docker exec -it server-health-mongodb mongosh server_health_monitoring --eval "db.input.find()"
docker exec -it server-health-mongodb mongosh server_health_monitoring --eval "db.result.find()"
docker exec -it server-health-mongodb mongosh server_health_monitoring --eval "db.input.aggregate([{`$unwind:'`$readings'},{`$count:'total_readings'}])"
docker exec -it server-health-mongodb mongosh server_health_monitoring --eval "db.input.find({server_id:'SRV-02'})"
```

> In PowerShell, `$` inside double quotes must be escaped with a backtick (`` `$unwind ``). Inside the interactive mongosh shell, type `$unwind` normally.
> If you run these from a non-interactive context (a script or CI), drop `-it`.

## 6. View logs and service health

```powershell
docker compose ps
docker compose logs -f backend      # Ctrl+C to stop following
docker compose logs -f frontend
docker compose logs -f mongodb
docker compose logs --tail 50       # all services
Invoke-RestMethod http://localhost:5000/api/health
docker inspect --format '{{.State.Health.Status}}' server-health-mongodb
```

## 7. Stop the application (data is kept)

```powershell
docker compose stop
```

## 8. Restart without losing records

```powershell
docker compose start
# or, after "docker compose down" (containers removed, volume kept):
docker compose up -d
```

## 9. Reset only this project's sample data

This deletes all documents in `input` and `result` (including readings you added from the dashboard), restores the 12 sample documents, and re-runs aggregation:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/seed -ContentType 'application/json' -Body '{"reset":true}'
```

The equivalent through the MongoDB CLI:

```powershell
docker exec -it server-health-mongodb mongosh server_health_monitoring --eval "db.input.deleteMany({}); db.result.deleteMany({})"
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/seed -ContentType 'application/json' -Body '{}'
```

## 10. Complete shutdown and removal (deletes the database)

```powershell
docker compose down -v
```

**Stopping vs. deleting the volume:**
- `docker compose stop` and `docker compose down` stop or remove the containers only. MongoDB's files stay in the named volume `server-health-monitoring_mongodb_data`, so all records come back on the next start.
- `docker compose down -v` also deletes that volume. All MongoDB data is permanently lost. The next `docker compose up` starts with an empty database, and the backend auto-seeds it again.

## API endpoints

| Method | Path             | Description |
|--------|------------------|-------------|
| GET    | `/api/health`    | Ping MongoDB; returns connection status and collection names (503 if disconnected) |
| GET    | `/api/servers`   | The 3 servers with input/reading counts and their latest result |
| GET    | `/api/input`     | Input documents (newest first, `?limit=`, `?server_id=`), plus total document and reading counts |
| GET    | `/api/results`   | All result documents plus a healthy/unhealthy summary |
| POST   | `/api/input`     | `{"server_id":"SRV-02","cpu_util":87.5}` (optional `timestamp`). Validates, inserts, re-aggregates automatically |
| POST   | `/api/seed`      | Idempotent seed; `{"reset":true}` wipes both collections first |
| POST   | `/api/aggregate` | Manual aggregation run (for demos) |

Example of a real-time insert from PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/input -ContentType 'application/json' -Body '{"server_id":"SRV-01","cpu_util":91.5}'
```

Invalid readings (unknown server, value outside 0–100, non-numeric value, future timestamp, malformed JSON) return HTTP 400 with details. A database outage returns 503, and an aggregation failure returns 500.

## Data model

`input` document (one document holds 3 hourly readings; field names follow `input_schema.py`):

```json
{
  "report_id": "SEED-SRV-02-01", "server_id": "SRV-02", "device_id": "DEV-1002",
  "server_name": "Server-02", "metric_type": "CPU_UTILIZATION", "unit": "percent", "threshold": 80,
  "report_type": "HOURLY_CPU_REPORT", "model": "ProLiant DL380", "processor_vendor": "AMD",
  "server_generation": "Gen10", "location_name": "Campus Data Center - Rack B",
  "readings": [
    { "Time": "2026-10-23T08:00:00Z", "CpuUtil": 78.4 },
    { "Time": "2026-10-23T09:00:00Z", "CpuUtil": 82.6 },
    { "Time": "2026-10-23T10:00:00Z", "CpuUtil": 85.1 }
  ],
  "timestamp": "2026-10-23T08:00:00Z", "created_at": "2026-10-23T08:00:00Z", "source": "seed"
}
```

Seed data: 3 servers × 4 documents × 3 hourly readings = **12 documents, 36 readings**, covering 2026-10-23 08:00–19:00 UTC. Readings added from the dashboard are stored as new documents with one reading each (`source: "dashboard"`).

`result` document (one per server; field names follow `output_schema.py`): `server_id`, `device_id`, `server_name`, `metric_type`, `avg_metric_value`, `min_metric_value`, `max_metric_value`, `max_metric_time`, `threshold`, `reading_count`, `readings_above_threshold`, `input_document_count`, `first_reading_time`, `last_reading_time`, `status` (boolean, `true` = healthy), `health_status`, `error_reason`, `calculated_at`.

Expected initial results:

| Server    | Avg    | Min  | Max  | Breaches | Status   |
|-----------|--------|------|------|----------|----------|
| Server-01 | 42.15  | 32.5 | 52.3 | 0 / 12   | HEALTHY  |
| Server-02 | 88.32  | 78.4 | 95.6 | 11 / 12  | CRITICAL |
| Server-03 | 67.01  | 55.2 | 84.2 | 2 / 12   | WARNING  |

## Aggregation and threshold validation

The pipeline (`backend/src/aggregation.js`) runs on `input`:

1. `$match`: CPU utilization documents only.
2. `$unwind: "$readings"`: one document per hourly reading.
3. `$match`: keep only numeric readings.
4. `$group` by `server_id`: `$avg`, `$min`, `$max`, `$sum: 1` (reading count), the number of readings ≥ threshold, and `$top` for the time of the peak.
5. `$set`: round the values to 2 decimals.
6. `$project`: build the result document and derive `health_status`, `status` and `error_reason`.
7. `$merge` into `result` `on: "server_id"` (backed by a unique index), with `whenMatched: "replace"` and `whenNotMatched: "insert"`. Re-running updates the 3 summaries in place and never creates duplicates.

Validation rules (threshold = 80%):
- **HEALTHY**: maximum < 80%, so every reading and the average are below the threshold.
- **WARNING** (unhealthy): at least one reading ≥ 80%, but the average is < 80%.
- **CRITICAL** (unhealthy): average ≥ 80%.

A server whose maximum reaches 80% is never shown as healthy. The aggregation runs automatically after every successful `POST /api/input`, and the dashboard refreshes right after the insert (and polls every 10 s).

## Security notes

- MongoDB runs **without authentication** for simplicity in the lab. Its port 27017 is **not published** to the host, so it is reachable only from containers on the Compose network and through `docker exec`. If you enable auth, set `MONGO_INITDB_ROOT_USERNAME`/`MONGO_INITDB_ROOT_PASSWORD` in `.env`, add `username:password@` and `?authSource=admin` to `MONGODB_URI`, and add `-u`/`-p` to the mongosh commands.
- The API on port 5000 has no authentication. It is meant for local demonstrations only.
- `.env` is git-ignored. Only `.env.example` (no credentials) is meant to be committed.
