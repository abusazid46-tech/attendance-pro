# API Documentation

Swagger is served by the backend at:

- Local: `http://localhost:4000/docs`
- JSON spec: `http://localhost:4000/docs.json`

Core API groups:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/academics/hierarchy`
- `POST /api/v1/attendance`
- `PATCH /api/v1/attendance/:attendanceId`
- `GET /api/v1/analytics/faculty-dashboard`
- `GET /api/v1/analytics/students/:studentId`
- `POST /api/v1/qr-attendance/sessions`
- `POST /api/v1/leave-requests`
- `GET /api/v1/reports/daily`

All protected routes use:

```http
Authorization: Bearer <access-token>
```
