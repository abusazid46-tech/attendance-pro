<?php

use App\Http\Controllers\AcademicsController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BackupsController;
use App\Http\Controllers\LeaveController;
use App\Http\Controllers\QrAttendanceController;
use App\Http\Controllers\ReportsController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'service' => 'attendance-laravel-api',
    'time' => now()->toIso8601String(),
]));

Route::prefix('api/v1')->group(function () {
    Route::post('/auth/register-teacher', [AuthController::class, 'registerTeacher']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

    Route::middleware('api.auth')->group(function () {
        Route::post('/users/avatar', [AuthController::class, 'uploadAvatar']);
        Route::get('/admin/users', [AdminController::class, 'users']);
        Route::patch('/admin/users/{userId}', [AdminController::class, 'updateUser']);
        Route::patch('/admin/users/{userId}/status', [AdminController::class, 'setUserStatus']);
        Route::delete('/admin/users/{userId}', [AdminController::class, 'deleteUser']);
        Route::get('/academics/hierarchy', [AcademicsController::class, 'hierarchy']);
        Route::post('/academics/profile', [AcademicsController::class, 'saveProfile']);
        Route::post('/academics/sessions', [AcademicsController::class, 'createSession']);
        Route::patch('/academics/departments/{departmentId}', [AcademicsController::class, 'updateDepartment']);
        Route::delete('/academics/departments/{departmentId}', [AcademicsController::class, 'deleteDepartment']);
        Route::patch('/academics/courses/{courseId}', [AcademicsController::class, 'updateCourse']);
        Route::delete('/academics/courses/{courseId}', [AcademicsController::class, 'deleteCourse']);
        Route::post('/academics/semesters', [AcademicsController::class, 'createSemester']);
        Route::patch('/academics/semesters/{semesterId}', [AcademicsController::class, 'updateSemester']);
        Route::delete('/academics/semesters/{semesterId}', [AcademicsController::class, 'deleteSemester']);
        Route::patch('/academics/sections/{sectionId}', [AcademicsController::class, 'updateSection']);
        Route::delete('/academics/sections/{sectionId}', [AcademicsController::class, 'deleteSection']);
        Route::post('/academics/subjects', [AcademicsController::class, 'addSubject']);
        Route::put('/academics/subjects/{subjectId}', [AcademicsController::class, 'updateSubject']);
        Route::delete('/academics/subjects/{subjectId}', [AcademicsController::class, 'deleteSubject']);
        Route::post('/academics/enrollments', [AcademicsController::class, 'enrollStudents']);
        Route::get('/attendance/students', [AttendanceController::class, 'students']);
        Route::get('/attendance/students/{studentId}/records', [AttendanceController::class, 'studentRecords']);
        Route::post('/attendance/students', [AttendanceController::class, 'createStudent']);
        Route::post('/attendance/students/bulk', [AttendanceController::class, 'bulkStudents']);
        Route::patch('/attendance/students/{studentId}', [AttendanceController::class, 'updateStudent']);
        Route::delete('/attendance/students/{studentId}', [AttendanceController::class, 'deleteStudent']);
        Route::post('/attendance/classes', [AttendanceController::class, 'createClass']);
        Route::get('/attendance/calendar', [AttendanceController::class, 'calendar']);
        Route::get('/attendance', [AttendanceController::class, 'index']);
        Route::post('/attendance', [AttendanceController::class, 'store']);
        Route::patch('/attendance/{attendanceId}', [AttendanceController::class, 'update']);
        Route::get('/analytics/faculty-dashboard', [AnalyticsController::class, 'facultyDashboard']);
        Route::get('/analytics/students/{studentId}', [AnalyticsController::class, 'student']);
        Route::post('/qr-attendance/sessions', [QrAttendanceController::class, 'createSession']);
        Route::post('/qr-attendance/scan', [QrAttendanceController::class, 'scan']);
        Route::post('/leave-requests', [LeaveController::class, 'store']);
        Route::post('/reports', [ReportsController::class, 'store']);
        Route::get('/reports/daily', [ReportsController::class, 'daily']);
        Route::post('/backups', [BackupsController::class, 'store']);
        Route::get('/backups', [BackupsController::class, 'index']);
    });
});
