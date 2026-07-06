<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('name')->unique();
            $table->json('permissions');
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('email')->unique();
            $table->string('mobile_number')->nullable()->unique();
            $table->string('password_hash');
            $table->string('full_name');
            $table->string('avatar_url')->nullable();
            $table->string('role_id', 40);
            $table->boolean('is_active')->default(true);
            $table->string('refresh_token_hash', 255)->nullable();
            $table->string('password_reset_token')->nullable();
            $table->timestamp('reset_token_expiry')->nullable();
            $table->timestamps();
            $table->foreign('role_id')->references('id')->on('roles');
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('name');
            $table->string('code')->unique();
            $table->timestamps();
        });

        Schema::create('courses', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('department_id', 40);
            $table->timestamps();
            $table->foreign('department_id')->references('id')->on('departments');
        });

        Schema::create('semesters', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('name');
            $table->unsignedInteger('number');
            $table->string('course_id', 40);
            $table->timestamps();
            $table->foreign('course_id')->references('id')->on('courses');
        });

        Schema::create('sections', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('name');
            $table->string('semester_id', 40);
            $table->timestamps();
            $table->foreign('semester_id')->references('id')->on('semesters');
        });

        Schema::create('subjects', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('department_id', 40);
            $table->string('semester_id', 40);
            $table->string('section_id', 40);
            $table->timestamps();
            $table->foreign('department_id')->references('id')->on('departments');
            $table->foreign('semester_id')->references('id')->on('semesters');
            $table->foreign('section_id')->references('id')->on('sections');
        });

        Schema::create('academic_sessions', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('name');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->boolean('is_active')->default(false);
            $table->string('teacher_id', 40)->nullable();
            $table->timestamps();
        });

        Schema::create('teachers', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('user_id', 40)->unique();
            $table->string('employee_code')->unique();
            $table->string('designation')->nullable();
            $table->string('institution_name')->nullable();
            $table->string('department_id', 40);
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users');
            $table->foreign('department_id')->references('id')->on('departments');
        });

        Schema::table('academic_sessions', function (Blueprint $table) {
            $table->foreign('teacher_id')->references('id')->on('teachers');
        });

        Schema::create('section_teacher', function (Blueprint $table) {
            $table->string('section_id', 40);
            $table->string('teacher_id', 40);
            $table->primary(['section_id', 'teacher_id']);
        });

        Schema::create('subject_teacher', function (Blueprint $table) {
            $table->string('subject_id', 40);
            $table->string('teacher_id', 40);
            $table->primary(['subject_id', 'teacher_id']);
        });

        Schema::create('students', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('user_id', 40)->unique();
            $table->string('roll_number');
            $table->string('registration_number')->unique();
            $table->string('department_id', 40);
            $table->string('course_id', 40);
            $table->string('semester_id', 40);
            $table->string('section_id', 40);
            $table->timestamps();
            $table->unique(['roll_number', 'section_id']);
            $table->foreign('user_id')->references('id')->on('users');
            $table->foreign('department_id')->references('id')->on('departments');
            $table->foreign('course_id')->references('id')->on('courses');
            $table->foreign('semester_id')->references('id')->on('semesters');
            $table->foreign('section_id')->references('id')->on('sections');
        });

        Schema::create('student_subject_enrollments', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('student_id', 40);
            $table->string('subject_id', 40);
            $table->string('semester_id', 40);
            $table->timestamp('created_at')->nullable();
            $table->unique(['student_id', 'subject_id']);
            $table->index(['subject_id', 'semester_id']);
        });

        Schema::create('parent_accounts', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('user_id', 40)->unique();
            $table->string('student_id', 40);
            $table->string('relation');
            $table->timestamps();
        });

        Schema::create('class_sessions', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('teacher_id', 40);
            $table->string('academic_session_id', 40)->nullable();
            $table->string('subject_id', 40);
            $table->string('department_id', 40);
            $table->string('course_id', 40);
            $table->string('semester_id', 40);
            $table->string('section_id', 40);
            $table->date('date');
            $table->unsignedInteger('class_number');
            $table->string('topic_taught');
            $table->unsignedInteger('duration_minutes');
            $table->string('status')->default('ATTENDANCE_PENDING');
            $table->timestamps();
            $table->unique(['subject_id', 'date', 'class_number']);
            $table->index(['teacher_id', 'date']);
        });

        Schema::create('class_diary_entries', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('class_session_id', 40)->unique();
            $table->string('topic_taught');
            $table->string('assignment_given')->nullable();
            $table->text('notes')->nullable();
            $table->text('observations')->nullable();
            $table->timestamps();
        });

        Schema::create('attendance', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('class_session_id', 40)->nullable();
            $table->string('student_id', 40);
            $table->string('teacher_id', 40);
            $table->string('subject_id', 40);
            $table->string('department_id', 40);
            $table->string('course_id', 40);
            $table->string('semester_id', 40);
            $table->string('section_id', 40);
            $table->date('date');
            $table->string('status');
            $table->string('remark')->nullable();
            $table->string('source')->default('MANUAL');
            $table->string('offline_sync_id')->nullable()->unique();
            $table->timestamps();
            $table->unique(['student_id', 'subject_id', 'date']);
            $table->index(['teacher_id', 'date']);
            $table->index(['section_id', 'subject_id', 'date']);
        });

        Schema::create('leave_requests', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('student_id', 40);
            $table->date('start_date');
            $table->date('end_date');
            $table->text('reason');
            $table->string('document_url')->nullable();
            $table->string('status')->default('PENDING');
            $table->string('reviewer_id', 40)->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('reviewer_note')->nullable();
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('user_id', 40);
            $table->string('type');
            $table->string('title');
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->json('data')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('entity_type');
            $table->string('entity_id');
            $table->string('attendance_id', 40)->nullable();
            $table->json('previous_value')->nullable();
            $table->json('updated_value')->nullable();
            $table->string('updated_by_id', 40);
            $table->text('reason')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['entity_type', 'entity_id']);
        });

        Schema::create('qr_attendance_sessions', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('token_hash')->unique();
            $table->string('teacher_id', 40);
            $table->string('subject_id', 40);
            $table->string('section_id', 40);
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('generated_reports', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('teacher_id', 40);
            $table->string('type');
            $table->string('format');
            $table->string('title');
            $table->json('filters')->nullable();
            $table->string('share_channel')->nullable();
            $table->string('file_url')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->index(['teacher_id', 'type']);
        });

        Schema::create('backup_snapshots', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('teacher_id', 40);
            $table->string('target');
            $table->string('status')->default('COMPLETED');
            $table->string('file_url')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['teacher_id', 'target']);
        });
    }

    public function down(): void
    {
        foreach ([
            'backup_snapshots',
            'generated_reports',
            'qr_attendance_sessions',
            'audit_logs',
            'notifications',
            'leave_requests',
            'attendance',
            'class_diary_entries',
            'class_sessions',
            'parent_accounts',
            'student_subject_enrollments',
            'students',
            'subject_teacher',
            'section_teacher',
            'teachers',
            'academic_sessions',
            'subjects',
            'sections',
            'semesters',
            'courses',
            'departments',
            'users',
            'roles',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
