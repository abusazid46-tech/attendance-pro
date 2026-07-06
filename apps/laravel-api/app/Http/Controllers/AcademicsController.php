<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AcademicsController
{
    public function hierarchy()
    {
        return response()->json([
            'departments' => DB::table('departments')->orderBy('name')->get(),
            'courses' => DB::table('courses')->orderBy('name')->get(),
            'semesters' => DB::table('semesters')->orderBy('number')->get(),
            'sections' => DB::table('sections')->orderBy('name')->get(),
            'subjects' => DB::table('subjects')->orderBy('code')->get(),
        ]);
    }

    public function saveProfile(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2'],
            'designation' => ['nullable', 'string'],
            'department' => ['required', 'string', 'min:2'],
            'institutionName' => ['nullable', 'string'],
            'mobileNumber' => ['nullable', 'string'],
            'email' => ['required', 'email'],
        ]);

        $auth = $request->attributes->get('auth');
        $userId = $auth['sub'] ?? null;
        if (!$userId) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $departmentId = $this->ensureDepartment($data['department']);

        DB::transaction(function () use ($data, $departmentId, $userId) {
            DB::table('users')->where('id', $userId)->update([
                'email' => $data['email'],
                'mobile_number' => $data['mobileNumber'] ?? null,
                'full_name' => $data['name'],
                'updated_at' => now(),
            ]);

            DB::table('teachers')->updateOrInsert(['user_id' => $userId], [
                'id' => DB::table('teachers')->where('user_id', $userId)->value('id') ?? (string) Str::ulid(),
                'employee_code' => 'FAC-'.substr($userId, -6),
                'designation' => $data['designation'] ?? null,
                'institution_name' => $data['institutionName'] ?? null,
                'department_id' => $departmentId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json(['message' => 'Profile saved']);
    }

    public function createSession(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3'],
            'startsOn' => ['nullable', 'date'],
            'endsOn' => ['nullable', 'date'],
        ]);

        DB::table('academic_sessions')->updateOrInsert(['id' => 'seed-session-1'], [
            'name' => $data['name'],
            'starts_on' => $data['startsOn'] ?? now()->startOfYear()->toDateString(),
            'ends_on' => $data['endsOn'] ?? now()->startOfYear()->addYear()->subDay()->toDateString(),
            'is_active' => true,
            'teacher_id' => $this->teacherId($request),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['session' => DB::table('academic_sessions')->where('id', 'seed-session-1')->first()], 201);
    }

    public function addSubject(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'min:2'],
            'name' => ['required', 'string', 'min:2'],
            'departmentId' => ['nullable', 'string'],
            'semesterId' => ['nullable', 'string'],
            'sectionId' => ['nullable', 'string'],
        ]);

        $code = strtoupper($data['code']);
        $existing = DB::table('subjects')->where('code', $code)->first();
        $subjectId = $existing->id ?? (Str::slug(strtolower($data['code'])) ?: (string) Str::ulid());

        DB::table('subjects')->updateOrInsert(['code' => $code], [
            'id' => $subjectId,
            'name' => $data['name'],
            'department_id' => $data['departmentId'] ?? 'seed-department-1',
            'semester_id' => $data['semesterId'] ?? 'seed-semester-1',
            'section_id' => $data['sectionId'] ?? 'seed-section-1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $subject = DB::table('subjects')->where('code', $code)->first();
        DB::table('subject_teacher')->updateOrInsert([
            'subject_id' => $subject->id,
            'teacher_id' => $this->teacherId($request),
        ]);

        return response()->json(['subject' => $subject], 201);
    }

    public function enrollStudents(Request $request)
    {
        $data = $request->validate([
            'subjectId' => ['required', 'string'],
            'semesterId' => ['required', 'string'],
            'studentIds' => ['required', 'array', 'min:1'],
            'studentIds.*' => ['required', 'string'],
        ]);

        foreach ($data['studentIds'] as $studentId) {
            DB::table('student_subject_enrollments')->updateOrInsert(
                ['student_id' => $studentId, 'subject_id' => $data['subjectId']],
                [
                    'id' => $data['subjectId'].'-'.$studentId,
                    'semester_id' => $data['semesterId'],
                    'created_at' => now(),
                ]
            );
        }

        return response()->json(['message' => 'Students mapped', 'count' => count($data['studentIds'])]);
    }

    private function teacherId(Request $request): string
    {
        $auth = $request->attributes->get('auth');
        return DB::table('teachers')->where('user_id', $auth['sub'] ?? null)->value('id') ?? 'seed-teacher-1';
    }

    private function ensureDepartment(string $name): string
    {
        $existing = DB::table('departments')->where('name', $name)->first();
        if ($existing) {
            return $existing->id;
        }

        $id = (string) Str::ulid();
        DB::table('departments')->insert([
            'id' => $id,
            'name' => $name,
            'code' => strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 8)).random_int(10, 99),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }
}
