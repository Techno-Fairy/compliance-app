# Compliance Management App

A mobile compliance management application for Botswana SMEs.

**Stack:** FastAPI · React Native (Expo) · PostgreSQL · SQLite (offline cache)

---

## Project Structure

```
compliance-app/
├── backend/              FastAPI REST API
│   ├── app/
│   │   ├── api/v1/       Route handlers
│   │   ├── core/         Config & JWT security
│   │   ├── db/           Database engine & session
│   │   ├── models/       SQLAlchemy ORM models
│   │   ├── schemas/      Pydantic request/response schemas
│   │   ├── services/     Business logic (Week 2+)
│   │   └── tasks/        APScheduler jobs (Week 4)
│   ├── alembic/          Database migrations
│   └── tests/
└── mobile/               React Native (Expo Router) app
    ├── app/
    │   ├── (auth)/       Login & Register screens
    │   └── (tabs)/       Dashboard, Vault, Reports, Settings
    ├── components/       Shared UI components (Week 2+)
    ├── hooks/            React Query data hooks
    ├── lib/              Axios client with JWT interceptors
    ├── store/            Zustand global state
    └── types/            Shared TypeScript interfaces
```

---

## Getting Started

### Prerequisites
- Python 3.10+  (install from python.org — check "Add to PATH")
- Node.js 18+   (install from nodejs.org)
- PostgreSQL     (install from postgresql.org)
- Git Bash       (already installed if running this script)

### 1 — Create the database

```bash
psql -U postgres -c "CREATE DATABASE compliance_db;"
```

### 2 — Start the backend

```bash
cd backend

# Windows (Git Bash)
source .venv/Scripts/activate

# macOS / Linux
source .venv/bin/activate

# Fill in your environment variables
cp .env.example .env   # already done by setup.sh

# Run migrations
alembic upgrade head

# Start dev server  →  http://localhost:8000
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs  *(only when DEBUG=true)*

### 3 — Start the mobile app

```bash
cd mobile
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone, or press `a` for Android emulator / `i` for iOS simulator.

---

## Team

| Student   | Programme                          | Focus                            |
|-----------|------------------------------------|----------------------------------|
| Student A | Applied Business Computing         | Backend, API, database, DevOps   |
| Student B | BI & Data Analytics                | Frontend, analytics, QA, reports |

---

## Environment Variables

| File                  | Key variable        | Description                  |
|-----------------------|---------------------|------------------------------|
| `backend/.env`        | `DATABASE_URL`      | PostgreSQL connection string |
| `backend/.env`        | `SECRET_KEY`        | JWT signing secret           |
| `backend/.env`        | `FCM_SERVER_KEY`    | Firebase push notifications  |
| `mobile/.env`         | `EXPO_PUBLIC_API_URL` | Backend API base URL       |
