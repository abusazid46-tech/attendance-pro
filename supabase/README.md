# Supabase Backend

Use Supabase as the main backend for Smart Attendance Assistant.

## Setup

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Authentication > Users**, create a teacher user:
   - email: `teacher@attendance.local`
   - password: `Password@123`
4. Copy the project URL and anon public key into the mobile env:

```env
EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
```

The mobile app creates the teacher profile, academic session, papers, and demo student master records after the first successful Supabase login.
