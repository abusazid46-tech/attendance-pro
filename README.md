# Attendance Management System

Enterprise-ready starter for schools, colleges, coaching institutes, and universities.

## Apps

- `supabase`: Main backend schema for Auth, Postgres tables, RLS policies, reports, diary, and backups.
- `apps/api`: Legacy/optional Express, TypeScript, PostgreSQL, Prisma, JWT, RBAC, Swagger.
- `apps/mobile`: Expo SDK 56, React Native, Expo Router, React Query, Zustand, React Hook Form, Zod.
- `apps/admin`: Next.js 15 App Router, TypeScript, Tailwind CSS, Recharts-style dashboard structure.

## Smart Attendance Assistant Workflow

The mobile app now follows a teacher-centric Smart Attendance Assistant flow:

- First-time setup wizard for teacher profile and academic session creation.
- Semester, paper, and master student database mapping.
- Start New Class with class number, topic taught, duration, and diary details.
- Smart attendance defaults every student to present; the teacher only marks absent, late, or leave informed.
- Attendance calendar, student-wise analytics, defaulter monitoring, and threshold color coding.
- PDF/Excel report actions for individual, subject, semester, monthly, defaulter, eligibility, and teaching diary reports.
- WhatsApp, email, and Telegram share message generation.
- Google Drive and local backup/restore records.

## Quick Start

### Supabase Backend

```bash
cp .env.example .env
```

Create a Supabase project, run `supabase/schema.sql` in the Supabase SQL Editor, then set:

```env
EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
```

Create the teacher user in Supabase Auth:

- Email: `teacher@attendance.local`
- Password: `Password@123`

The mobile app now logs in with Supabase Auth and writes setup, papers, students, attendance, reports, diary, and backup records directly to Supabase.

### Legacy Express API

```bash
cp .env.example .env
npm install
npm --workspace @attendance/api run db:generate
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev
```

## Seed Accounts

- Super Admin: `superadmin@attendance.local` / `Password@123`
- Admin: `admin@attendance.local` / `Password@123`
- Faculty: `teacher@attendance.local` / `Password@123`
- Student: `student@attendance.local` / `Password@123`

Rotate these credentials before production use.

## Architecture

The system is split by ownership:

- Supabase is the primary backend for mobile production usage.
- Mobile app keeps Supabase services separate from offline SQLite sync.
- API modules remain available for legacy/custom server workflows.
- Admin dashboard can be migrated next to the same Supabase tables.

See `docs/API.md` and `docs/DEPLOYMENT.md`.
