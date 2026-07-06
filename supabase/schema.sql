create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id text primary key,
  email text unique,
  mobile_number text,
  full_name text not null,
  role text not null default 'FACULTY',
  designation text,
  department text,
  institution_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_sessions (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.profiles(id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.semesters (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.profiles(id) on delete cascade,
  name text not null,
  number integer,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.profiles(id) on delete cascade,
  semester_id text references public.semesters(id) on delete set null,
  department_id text references public.departments(id) on delete set null,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, code)
);

create table if not exists public.students (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.profiles(id) on delete cascade,
  roll_number text not null,
  full_name text not null,
  mobile_number text,
  guardian_mobile text,
  default_remark text,
  created_at timestamptz not null default now(),
  unique (teacher_id, roll_number)
);

create table if not exists public.subject_enrollments (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.profiles(id) on delete cascade,
  subject_id text not null references public.subjects(id) on delete cascade,
  semester_id text references public.semesters(id) on delete set null,
  student_id text not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id, student_id)
);

create table if not exists public.class_sessions (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.profiles(id) on delete cascade,
  academic_session_id text references public.academic_sessions(id) on delete set null,
  department_id text references public.departments(id) on delete set null,
  semester_id text references public.semesters(id) on delete set null,
  section_id text,
  subject_id text references public.subjects(id) on delete set null,
  class_date date not null,
  class_number integer not null,
  topic_taught text not null,
  duration_minutes integer not null default 60,
  assignment_given text,
  notes text,
  observations text,
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id, class_date, class_number)
);

create table if not exists public.attendance_records (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.profiles(id) on delete cascade,
  class_session_id text not null references public.class_sessions(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  subject_id text references public.subjects(id) on delete set null,
  attendance_date date not null,
  status text not null check (status in ('PRESENT', 'ABSENT', 'LATE', 'LEAVE')),
  remark text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  unique (teacher_id, class_session_id, student_id)
);

create table if not exists public.generated_reports (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.profiles(id) on delete cascade,
  report_type text not null,
  report_format text not null check (report_format in ('PDF', 'EXCEL')),
  title text not null,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'QUEUED',
  file_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.backup_snapshots (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.profiles(id) on delete cascade,
  target text not null check (target in ('GOOGLE_DRIVE', 'LOCAL_STORAGE')),
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'COMPLETED',
  file_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.departments enable row level security;
alter table public.semesters enable row level security;
alter table public.subjects enable row level security;
alter table public.students enable row level security;
alter table public.subject_enrollments enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.generated_reports enable row level security;
alter table public.backup_snapshots enable row level security;

drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows" on public.profiles
  for all using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

drop policy if exists "academic sessions own rows" on public.academic_sessions;
create policy "academic sessions own rows" on public.academic_sessions
  for all using (teacher_id = auth.uid()::text)
  with check (teacher_id = auth.uid()::text);

drop policy if exists "departments own rows" on public.departments;
create policy "departments own rows" on public.departments
  for all using (teacher_id = auth.uid()::text)
  with check (teacher_id = auth.uid()::text);

drop policy if exists "semesters own rows" on public.semesters;
create policy "semesters own rows" on public.semesters
  for all using (teacher_id = auth.uid()::text)
  with check (teacher_id = auth.uid()::text);

drop policy if exists "subjects own rows" on public.subjects;
create policy "subjects own rows" on public.subjects
  for all using (teacher_id = auth.uid()::text)
  with check (teacher_id = auth.uid()::text);

drop policy if exists "students own rows" on public.students;
create policy "students own rows" on public.students
  for all using (teacher_id = auth.uid()::text)
  with check (teacher_id = auth.uid()::text);

drop policy if exists "subject enrollments own rows" on public.subject_enrollments;
create policy "subject enrollments own rows" on public.subject_enrollments
  for all using (teacher_id = auth.uid()::text)
  with check (teacher_id = auth.uid()::text);

drop policy if exists "class sessions own rows" on public.class_sessions;
create policy "class sessions own rows" on public.class_sessions
  for all using (teacher_id = auth.uid()::text)
  with check (teacher_id = auth.uid()::text);

drop policy if exists "attendance records own rows" on public.attendance_records;
create policy "attendance records own rows" on public.attendance_records
  for all using (teacher_id = auth.uid()::text)
  with check (teacher_id = auth.uid()::text);

drop policy if exists "generated reports own rows" on public.generated_reports;
create policy "generated reports own rows" on public.generated_reports
  for all using (teacher_id = auth.uid()::text)
  with check (teacher_id = auth.uid()::text);

drop policy if exists "backup snapshots own rows" on public.backup_snapshots;
create policy "backup snapshots own rows" on public.backup_snapshots
  for all using (teacher_id = auth.uid()::text)
  with check (teacher_id = auth.uid()::text);
