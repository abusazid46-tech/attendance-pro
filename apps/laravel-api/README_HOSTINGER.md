# Attendance Pro Laravel + MySQL Backend

This folder is the Hostinger-friendly PHP backend for the Attendance Pro app.

It keeps the same API prefix as the existing Node backend:

```txt
/api/v1
```

So the mobile/admin apps should only need their API URL changed after deployment.

## Why This Exists

The original backend is Node.js + Express + Prisma + PostgreSQL. That is better for VPS hosting, but it is not the cheapest/easiest Hostinger shared-hosting path.

This backend uses:

- Laravel framework
- PHP 8.2+
- MySQL / MariaDB
- JWT auth
- Hostinger-compatible `public/` document root

## Hostinger Setup

### 1. Create MySQL Database

In Hostinger hPanel:

1. Go to **Databases > MySQL Databases**
2. Create a database
3. Create a database user
4. Save:
   - DB name
   - DB username
   - DB password
   - DB host

### 2. Upload Backend

Upload this folder:

```txt
apps/laravel-api
```

Recommended server path:

```txt
domains/api.yourdomain.com/laravel-api
```

Set the domain or subdomain document root to:

```txt
laravel-api/public
```

If Hostinger does not let you change document root, place the `public` contents in `public_html` and keep the rest of the Laravel files outside `public_html`.

### 3. Install Composer Dependencies

If SSH is available:

```bash
cd laravel-api
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate --force
```

If SSH is not available:

1. Run `composer install --no-dev --optimize-autoloader` locally.
2. Upload the generated `vendor/` folder too.

### 4. Configure `.env`

Use `.env.example` as the template.

Required values:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.yourdomain.com

DB_CONNECTION=mysql
DB_HOST=your_hostinger_mysql_host
DB_PORT=3306
DB_DATABASE=your_db_name
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password

JWT_ACCESS_SECRET=use-a-long-random-secret-here
JWT_REFRESH_SECRET=use-another-long-random-secret-here
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

### 5. Run Database Setup

With SSH:

```bash
php artisan migrate --force
php artisan db:seed --force
php artisan config:cache
php artisan route:cache
```

Seeded login:

```txt
Email: teacher@attendance.local
Mobile: 9876543210
Password: Password@123
```

Change these before production launch.

### 6. Test API

Open:

```txt
https://api.yourdomain.com/health
```

Expected:

```json
{"status":"ok","service":"attendance-laravel-api"}
```

Then test login:

```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@attendance.local","password":"Password@123"}'
```

## App URL Changes

Mobile app:

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

Admin app:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

After changing the mobile API URL, rebuild the APK.

## Implemented API Contract

```txt
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/academics/hierarchy
POST /api/v1/academics/profile
POST /api/v1/academics/sessions
POST /api/v1/academics/subjects
POST /api/v1/academics/enrollments
GET  /api/v1/attendance/students
POST /api/v1/attendance/classes
GET  /api/v1/attendance/calendar
POST /api/v1/attendance
PATCH /api/v1/attendance/{attendanceId}
GET  /api/v1/analytics/faculty-dashboard
GET  /api/v1/analytics/students/{studentId}
POST /api/v1/qr-attendance/sessions
POST /api/v1/qr-attendance/scan
POST /api/v1/leave-requests
POST /api/v1/reports
GET  /api/v1/reports/daily
POST /api/v1/backups
```

## Production Notes

- Use HTTPS only.
- Set `APP_DEBUG=false`.
- Rotate seeded passwords.
- Keep `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` private.
- Backup MySQL daily from Hostinger hPanel.
- Do not expose the Laravel root folder publicly. Only `public/` should be web-accessible.
