<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminController
{
    public function users(Request $request)
    {
        $this->authorizeAdmin($request);

        $teachers = DB::table('teachers')
            ->join('users', 'users.id', '=', 'teachers.user_id')
            ->leftJoin('departments', 'departments.id', '=', 'teachers.department_id')
            ->where('teachers.id', 'not like', 'seed-%')
            ->select(
                'teachers.id',
                'teachers.user_id',
                'teachers.employee_code',
                'teachers.designation',
                'teachers.institution_name',
                'users.full_name',
                'users.email',
                'users.mobile_number',
                'users.is_active',
                'departments.name as department_name',
                'teachers.created_at'
            )
            ->orderByDesc('teachers.created_at')
            ->get();

        $students = DB::table('students')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->leftJoin('sections', 'sections.id', '=', 'students.section_id')
            ->leftJoin('semesters', 'semesters.id', '=', 'students.semester_id')
            ->where('students.id', 'not like', 'seed-%')
            ->select(
                'students.id',
                'students.user_id',
                'students.roll_number',
                'students.registration_number',
                'users.full_name',
                'users.email',
                'users.is_active',
                'sections.name as section_name',
                'semesters.name as semester_name',
                'students.created_at'
            )
            ->orderByRaw('CAST(students.roll_number AS UNSIGNED), students.roll_number')
            ->get();

        return response()->json([
            'counts' => [
                'teachers' => $teachers->count(),
                'students' => $students->count(),
                'total' => $teachers->count() + $students->count(),
            ],
            'teachers' => $teachers,
            'students' => $students,
        ]);
    }

    public function updateUser(Request $request, string $userId)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'fullName' => ['required', 'string', 'min:2', 'max:160'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($userId, 'id')],
            'mobileNumber' => ['nullable', 'string', 'max:30', Rule::unique('users', 'mobile_number')->ignore($userId, 'id')],
            'isActive' => ['required', 'boolean'],
            'designation' => ['nullable', 'string', 'max:120'],
            'institutionName' => ['nullable', 'string', 'max:190'],
            'employeeCode' => ['nullable', 'string', 'max:60'],
            'rollNumber' => ['nullable', 'string', 'max:40'],
        ]);

        $user = DB::table('users')->where('id', $userId)->first();
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        DB::transaction(function () use ($userId, $data) {
            DB::table('users')->where('id', $userId)->update([
                'full_name' => $data['fullName'],
                'email' => strtolower($data['email']),
                'mobile_number' => $data['mobileNumber'] ?? null,
                'is_active' => $data['isActive'],
                'updated_at' => now(),
            ]);

            $teacher = DB::table('teachers')->where('user_id', $userId)->first();
            if ($teacher) {
                DB::table('teachers')->where('user_id', $userId)->update([
                    'employee_code' => $data['employeeCode'] ?: $teacher->employee_code,
                    'designation' => $data['designation'] ?? null,
                    'institution_name' => $data['institutionName'] ?? $teacher->institution_name,
                    'updated_at' => now(),
                ]);
            }

            if (!empty($data['rollNumber'])) {
                DB::table('students')->where('user_id', $userId)->update([
                    'roll_number' => $data['rollNumber'],
                    'updated_at' => now(),
                ]);
            }
        });

        return response()->json(['message' => 'User updated']);
    }

    public function setUserStatus(Request $request, string $userId)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate(['isActive' => ['required', 'boolean']]);
        $updated = DB::table('users')
            ->where('id', $userId)
            ->where('id', 'not like', 'seed-%')
            ->update(['is_active' => $data['isActive'], 'updated_at' => now()]);

        return $updated
            ? response()->json(['message' => $data['isActive'] ? 'User approved' : 'User deactivated'])
            : response()->json(['message' => 'User not found'], 404);
    }

    public function deleteUser(Request $request, string $userId)
    {
        $this->authorizeAdmin($request);

        $user = DB::table('users')->where('id', $userId)->where('id', 'not like', 'seed-%')->first();
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        DB::transaction(function () use ($userId) {
            $teacher = DB::table('teachers')->where('user_id', $userId)->first();
            if ($teacher) {
                DB::table('subject_teacher')->where('teacher_id', $teacher->id)->delete();
                DB::table('section_teacher')->where('teacher_id', $teacher->id)->delete();
                DB::table('academic_sessions')->where('teacher_id', $teacher->id)->update(['teacher_id' => null, 'updated_at' => now()]);
                DB::table('teachers')->where('id', $teacher->id)->delete();
            }

            $student = DB::table('students')->where('user_id', $userId)->first();
            if ($student) {
                DB::table('student_subject_enrollments')->where('student_id', $student->id)->delete();
                DB::table('attendance')->where('student_id', $student->id)->delete();
                DB::table('leave_requests')->where('student_id', $student->id)->delete();
                DB::table('students')->where('id', $student->id)->delete();
            }

            DB::table('users')->where('id', $userId)->delete();
        });

        return response()->json(['message' => 'User deleted']);
    }

    private function authorizeAdmin(Request $request): void
    {
        $auth = $request->attributes->get('auth');
        if (!in_array($auth['role'] ?? '', ['ADMIN', 'SUPER_ADMIN'], true)) {
            abort(response()->json(['message' => 'Admin access required'], 403));
        }
    }
}
