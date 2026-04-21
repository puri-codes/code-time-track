# GitHub Analytics Dashboard

Production-ready full-stack dashboard built inside `web-analytics` with:

- React + TypeScript (TSX) frontend
- Express + TypeScript backend
- Tailwind CSS + Recharts SaaS-style UI
- GitHub REST analytics pipeline
- Common SQLite ingestion for extension telemetry + GitHub analytics from `../extension`

## Folder Structure

```text
web-analytics/
  backend/
    src/
      config/
      lib/
      routes/
      services/
      types/
      utils/
    data/analytics.db
  src/
    components/
    config/
    hooks/
    pages/
    services/
    types/
    utils/
```

## Features Implemented

### GitHub Analytics

- Repository validation (`owner/repo`)
- Repo metadata (`created_at`)
- Commit timeline with timestamps + author
- Push activity from `PushEvent`, with commit-time fallback
- PR lifecycle (created / merged / closed)
- Branch activity with last commit timestamp
- Branch-based timeline filtering

### Extension Analytics (from `extension` event model)

- Ingestion endpoint: `POST /api/extension/events`
- Analytics endpoint: `GET /api/extension/analytics?userId=...&projectId=...`
- Event schema mirrors `extension/src/events/eventTypes.ts`
- Metrics mirror extension dashboard logic:
  - Today coding time
  - Current session
  - Project tracking (active / idle / total)
  - Productivity score + insights
  - Folder analytics
  - Recent timeline

### Combined SQL Analytics

- Shared SQL storage for both extension events and GitHub analytics
- Auto-created database at backend startup
- Repository matching endpoint: `GET /api/analytics/comparison?userId=...&repo=owner/repo`
- Matched workspace comparison rendered in frontend

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill required variables:

```env
VITE_API_BASE_URL=http://localhost:4000
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
GITHUB_TOKEN=
ANALYTICS_DB_PATH=./backend/data/analytics.db
```

## Extension Integration

Configure your VS Code extension setting `devAnalytics.apiEndpoint` to:

```text
http://localhost:4000/api/extension/events
```

That allows extension events to be stored in the common SQL database and rendered in this dashboard.

## Development

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Production Build

```bash
npm run build
```

Build output:

- Frontend: `dist/`
- Backend: `backend/dist/`

## Customization Hooks

Edit these sections:

- `src/config/customConfig.ts`
- `backend/src/config/customConfig.ts`

They include:

```ts
// 🔧 CUSTOM CONFIG START
// (I will add things like filters, AI insights, extra metrics here)
// 🔧 CUSTOM CONFIG END
```
