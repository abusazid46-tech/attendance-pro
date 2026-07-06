# Hostinger Laravel + MySQL Migration

The cheapest/easiest Hostinger route for this project is now:

```txt
apps/laravel-api  ->  Hostinger PHP hosting
MySQL/MariaDB     ->  Hostinger MySQL database
Mobile/Admin      ->  point API URL to https://api.yourdomain.com/api/v1
```

Use this instead of deploying the Node/Prisma/PostgreSQL backend when the hosting target is ordinary Hostinger shared hosting.

## Deployment Folder

```txt
apps/laravel-api
```

Detailed instructions:

```txt
apps/laravel-api/README_HOSTINGER.md
```

## API URL

After deployment, set:

```txt
https://api.yourdomain.com/api/v1
```

Then rebuild:

- Admin web app
- Mobile APK

## Database

Use MySQL/MariaDB, not PostgreSQL, for this Laravel path.

The schema is created through Laravel migration:

```bash
php artisan migrate --force
php artisan db:seed --force
```

Seeded teacher login:

```txt
teacher@attendance.local
Password@123
```

Rotate this before client handoff.
