# Deployment Guide

## Local Production Simulation

1. Copy `.env.example` to `.env`.
2. Replace JWT secrets with long random values.
3. Run `docker compose up --build`.
4. Run migrations and seed data:

```bash
npm install
npm run db:migrate
npm run db:seed
```

## Backend

Deploy the API as a Node.js service with PostgreSQL. Required environment variables are listed in `.env.example`.

Health check:

```http
GET /health
```

## Admin Dashboard

Deploy `apps/admin` to Vercel or any Node host. Set:

```bash
NEXT_PUBLIC_API_URL=https://your-api.example.com/api/v1
```

## Mobile App

Use EAS Build:

```bash
cd apps/mobile
npm install
npx expo prebuild
npx eas build --platform android
```

Set `EXPO_PUBLIC_API_URL` to the deployed API base URL.
