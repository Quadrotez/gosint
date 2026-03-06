# OSINT Graph Intelligence Platform v2

A full-stack application for storing and visualizing OSINT data as a graph.

## Features
- 10 built-in entity types (person, email, phone, username, domain, IP, org, address, website, crypto wallet)
- Custom entity types with arbitrary fields
- Localized labels (EN / RU) for all types
- Person form with optional name fields
- Key-value metadata editor (no raw JSON)
- Graph visualization with Cytoscape.js
- Full-text search
- CSV import

## Stack
- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Environment
Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000/api
```
