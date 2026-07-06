<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $roles = [
            'role-super-admin' => ['SUPER_ADMIN', ['*']],
            'role-admin' => ['ADMIN', ['users:*', 'academics:*', 'attendance:read', 'reports:*']],
            'role-faculty' => ['FACULTY', ['attendance:create', 'attendance:update:own', 'analytics:own', 'leave:review']],
            'role-student' => ['STUDENT', ['attendance:read:self', 'leave:create']],
            'role-parent' => ['PARENT', ['attendance:read:child']],
        ];

        foreach ($roles as $id => [$name, $permissions]) {
            DB::table('roles')->updateOrInsert(['id' => $id], [
                'name' => $name,
                'permissions' => json_encode($permissions),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $passwordHash = Hash::make('Password@123');

        DB::table('departments')->updateOrInsert(['id' => 'seed-department-1'], [
            'name' => 'Library and Information Science',
            'code' => 'LIS',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('courses')->updateOrInsert(['id' => 'seed-course-1'], [
            'name' => 'Master of Library and Information Science',
            'code' => 'MLIS',
            'department_id' => 'seed-department-1',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('semesters')->updateOrInsert(['id' => 'seed-semester-1'], [
            'name' => 'Semester II',
            'number' => 2,
            'course_id' => 'seed-course-1',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('sections')->updateOrInsert(['id' => 'seed-section-1'], [
            'name' => 'A',
            'semester_id' => 'seed-semester-1',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        foreach ([
            ['seed-subject-1', 'Information Sources', 'LIS202'],
            ['seed-subject-2', 'Knowledge Organization', 'LIS201'],
            ['seed-subject-3', 'ICT Applications', 'LIS203'],
        ] as [$id, $name, $code]) {
            DB::table('subjects')->updateOrInsert(['id' => $id], [
                'name' => $name,
                'code' => $code,
                'department_id' => 'seed-department-1',
                'semester_id' => 'seed-semester-1',
                'section_id' => 'seed-section-1',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('academic_sessions')->updateOrInsert(['id' => 'seed-session-1'], [
            'name' => '2026-2027',
            'starts_on' => '2026-07-01',
            'ends_on' => '2027-06-30',
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->user('seed-super-admin-user', 'superadmin@attendance.local', null, 'Super Admin', 'role-super-admin', $passwordHash);
        $this->user('seed-admin-user', 'admin@attendance.local', null, 'Institute Admin', 'role-admin', $passwordHash);
        $this->user('seed-teacher-user', 'teacher@attendance.local', '9876543210', 'Ananya Sharma', 'role-faculty', $passwordHash);

        DB::table('teachers')->updateOrInsert(['id' => 'seed-teacher-1'], [
            'user_id' => 'seed-teacher-user',
            'employee_code' => 'FAC-001',
            'designation' => 'Assistant Professor',
            'institution_name' => 'Central University',
            'department_id' => 'seed-department-1',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('section_teacher')->updateOrInsert(['section_id' => 'seed-section-1', 'teacher_id' => 'seed-teacher-1']);
        DB::table('subject_teacher')->updateOrInsert(['subject_id' => 'seed-subject-1', 'teacher_id' => 'seed-teacher-1']);

        foreach ([
            ['seed-student-1', 'seed-student-user-1', 'Rahul Das', 'student@attendance.local', '01', 'REG-2026-001'],
            ['seed-student-2', 'seed-student-user-2', 'Anita Sharma', 'anita@attendance.local', '02', 'REG-2026-002'],
            ['seed-student-3', 'seed-student-user-3', 'Rina Das', 'rina@attendance.local', '14', 'REG-2026-014'],
            ['seed-student-4', 'seed-student-user-4', 'S. Ahmed', 's.ahmed@attendance.local', '21', 'REG-2026-021'],
            ['seed-student-5', 'seed-student-user-5', 'Meghna Borah', 'meghna@attendance.local', '27', 'REG-2026-027'],
        ] as [$studentId, $userId, $name, $email, $roll, $registration]) {
            $this->user($userId, $email, null, $name, 'role-student', $passwordHash);
            DB::table('students')->updateOrInsert(['id' => $studentId], [
                'user_id' => $userId,
                'roll_number' => $roll,
                'registration_number' => $registration,
                'department_id' => 'seed-department-1',
                'course_id' => 'seed-course-1',
                'semester_id' => 'seed-semester-1',
                'section_id' => 'seed-section-1',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('attendance')->updateOrInsert(
            ['student_id' => 'seed-student-1', 'subject_id' => 'seed-subject-1', 'date' => '2026-06-15'],
            [
                'id' => 'seed-attendance-1',
                'teacher_id' => 'seed-teacher-1',
                'department_id' => 'seed-department-1',
                'course_id' => 'seed-course-1',
                'semester_id' => 'seed-semester-1',
                'section_id' => 'seed-section-1',
                'status' => 'PRESENT',
                'source' => 'MANUAL',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }

    private function user(string $id, string $email, ?string $mobile, string $name, string $roleId, string $passwordHash): void
    {
        DB::table('users')->updateOrInsert(['id' => $id], [
            'email' => $email,
            'mobile_number' => $mobile,
            'full_name' => $name,
            'password_hash' => $passwordHash,
            'role_id' => $roleId,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
