<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AcademicsController
{
    private array $protectedPrefixes = ['seed-'];

    public function hierarchy(Request $request)
    {
        $teacherId = $this->teacherId($request);
        if ($this->isAdmin($request)) {
            return response()->json([
                'departments' => DB::table('departments')->where('id', 'not like', 'seed-%')->orderBy('name')->get(),
                'courses' => DB::table('courses')->where('id', 'not like', 'seed-%')->orderBy('name')->get(),
                'semesters' => DB::table('semesters')->where('id', 'not like', 'seed-%')->orderBy('number')->get(),
                'sections' => DB::table('sections')->where('id', 'not like', 'seed-%')->orderBy('name')->get(),
                'subjects' => DB::table('subjects')->where('id', 'not like', 'seed-%')->orderBy('code')->get(),
            ]);
        }

        $subjectIds = DB::table('subject_teacher')->where('teacher_id', $teacherId)->pluck('subject_id')->all();
        $directSectionIds = DB::table('section_teacher')->where('teacher_id', $teacherId)->pluck('section_id')->all();
        $subjects = DB::table('subjects')
            ->whereIn('id', $subjectIds ?: [''])
            ->where('id', 'not like', 'seed-%')
            ->orderBy('code')
            ->get();
        $sectionIds = collect($directSectionIds)->merge($subjects->pluck('section_id'))->filter()->unique()->values()->all();
        $sections = DB::table('sections')
            ->whereIn('id', $sectionIds ?: [''])
            ->where('id', 'not like', 'seed-%')
            ->orderBy('name')
            ->get();
        $semesterIds = $sections->pluck('semester_id')->merge($subjects->pluck('semester_id'))->filter()->unique()->values()->all();
        $semesters = DB::table('semesters')
            ->whereIn('id', $semesterIds ?: [''])
            ->where('id', 'not like', 'seed-%')
            ->orderBy('number')
            ->get();
        $courseIds = $semesters->pluck('course_id')->filter()->unique()->values()->all();
        $courses = DB::table('courses')
            ->whereIn('id', $courseIds ?: [''])
            ->where('id', 'not like', 'seed-%')
            ->orderBy('name')
            ->get();
        $teacherDepartmentId = DB::table('teachers')->where('id', $teacherId)->value('department_id');
        $departmentIds = $courses->pluck('department_id')->merge($subjects->pluck('department_id'))->push($teacherDepartmentId)->filter()->unique()->values()->all();

        return response()->json([
            'departments' => DB::table('departments')->whereIn('id', $departmentIds ?: [''])->where('id', 'not like', 'seed-%')->orderBy('name')->get(),
            'courses' => $courses,
            'semesters' => $semesters,
            'sections' => $sections,
            'subjects' => $subjects,
        ]);
    }

    public function saveProfile(Request $request)
    {
        $auth = $request->attributes->get('auth');
        $userId = $auth['sub'] ?? null;
        if (!$userId) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:160'],
            'designation' => ['nullable', 'string', 'max:120'],
            'department' => ['required', 'string', 'min:2', 'max:160'],
            'institutionName' => ['nullable', 'string', 'max:190'],
            'mobileNumber' => ['nullable', 'string', 'max:30', Rule::unique('users', 'mobile_number')->ignore($userId, 'id')],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($userId, 'id')],
        ]);

        $departmentId = $this->ensureDepartment($data['department']);

        DB::transaction(function () use ($data, $departmentId, $userId) {
            DB::table('users')->where('id', $userId)->update([
                'email' => strtolower($data['email']),
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

        $teacherId = $this->teacherId($request);
        $sessionId = 'ses-'.substr($teacherId, -8).'-'.substr(sha1($data['name']), 0, 12);

        DB::table('academic_sessions')->updateOrInsert(['id' => $sessionId], [
            'name' => $data['name'],
            'starts_on' => $data['startsOn'] ?? now()->startOfYear()->toDateString(),
            'ends_on' => $data['endsOn'] ?? now()->startOfYear()->addYear()->subDay()->toDateString(),
            'is_active' => true,
            'teacher_id' => $teacherId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['session' => DB::table('academic_sessions')->where('id', $sessionId)->first()], 201);
    }

    public function createSemester(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3'],
            'number' => ['nullable', 'integer', 'min:1', 'max:12'],
            'courseId' => ['nullable', 'string'],
            'sectionName' => ['nullable', 'string'],
        ]);

        $teacherId = $this->teacherId($request);
        $courseId = $data['courseId'] ?? $this->ensureCourse($teacherId);
        $numberFromName = (int) preg_replace('/\D+/', '', $data['name']);
        $number = $data['number'] ?? ($numberFromName ?: ((int) DB::table('semesters')->max('number') + 1));
        $semesterSlug = substr(Str::slug(strtolower($data['name'])) ?: (string) Str::ulid(), 0, 24);
        $semesterId = $semesterSlug.'-'.substr($teacherId, -8);
        $sectionId = $semesterId.'-section-a';

        DB::transaction(function () use ($data, $courseId, $number, $semesterId, $sectionId, $teacherId) {
            DB::table('semesters')->updateOrInsert(['id' => $semesterId], [
                'name' => $data['name'],
                'number' => $number,
                'course_id' => $courseId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('sections')->updateOrInsert(['id' => $sectionId], [
                'name' => $data['sectionName'] ?? 'A',
                'semester_id' => $semesterId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('section_teacher')->updateOrInsert([
                'section_id' => $sectionId,
                'teacher_id' => $teacherId,
            ]);
        });

        return response()->json([
            'semester' => DB::table('semesters')->where('id', $semesterId)->first(),
            'section' => DB::table('sections')->where('id', $sectionId)->first(),
        ], 201);
    }

    public function updateDepartment(Request $request, string $departmentId)
    {
        $this->guardSeed($departmentId);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2'],
            'code' => ['required', 'string', 'min:2', 'max:40'],
        ]);

        DB::table('departments')->where('id', $departmentId)->update([
            'name' => $data['name'],
            'code' => strtoupper($data['code']),
            'updated_at' => now(),
        ]);

        return response()->json(['department' => DB::table('departments')->where('id', $departmentId)->first()]);
    }

    public function deleteDepartment(string $departmentId)
    {
        $this->guardSeed($departmentId);
        DB::transaction(function () use ($departmentId) {
            $courseIds = DB::table('courses')->where('department_id', $departmentId)->pluck('id')->all();
            foreach ($courseIds as $courseId) {
                $this->deleteCourseRows($courseId);
            }
            $teacherIds = DB::table('teachers')->where('department_id', $departmentId)->pluck('id')->all();
            DB::table('academic_sessions')->whereIn('teacher_id', $teacherIds)->update(['teacher_id' => null, 'updated_at' => now()]);
            DB::table('section_teacher')->whereIn('teacher_id', $teacherIds)->delete();
            DB::table('subject_teacher')->whereIn('teacher_id', $teacherIds)->delete();
            DB::table('teachers')->whereIn('id', $teacherIds)->delete();
            DB::table('departments')->where('id', $departmentId)->delete();
        });

        return response()->json(['message' => 'Department deleted']);
    }

    public function updateCourse(Request $request, string $courseId)
    {
        $this->guardSeed($courseId);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2'],
            'code' => ['required', 'string', 'min:2', 'max:40'],
            'departmentId' => ['required', 'string'],
        ]);

        DB::table('courses')->where('id', $courseId)->update([
            'name' => $data['name'],
            'code' => strtoupper($data['code']),
            'department_id' => $data['departmentId'],
            'updated_at' => now(),
        ]);

        return response()->json(['course' => DB::table('courses')->where('id', $courseId)->first()]);
    }

    public function deleteCourse(string $courseId)
    {
        $this->guardSeed($courseId);
        DB::transaction(fn () => $this->deleteCourseRows($courseId));

        return response()->json(['message' => 'Course deleted']);
    }

    public function updateSemester(Request $request, string $semesterId)
    {
        $this->guardSeed($semesterId);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2'],
            'number' => ['required', 'integer', 'min:1', 'max:12'],
            'courseId' => ['required', 'string'],
        ]);

        DB::table('semesters')->where('id', $semesterId)->update([
            'name' => $data['name'],
            'number' => $data['number'],
            'course_id' => $data['courseId'],
            'updated_at' => now(),
        ]);

        return response()->json(['semester' => DB::table('semesters')->where('id', $semesterId)->first()]);
    }

    public function deleteSemester(string $semesterId)
    {
        $this->guardSeed($semesterId);
        DB::transaction(fn () => $this->deleteSemesterRows($semesterId));

        return response()->json(['message' => 'Semester deleted']);
    }

    public function updateSection(Request $request, string $sectionId)
    {
        $this->guardSeed($sectionId);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:1'],
            'semesterId' => ['required', 'string'],
        ]);

        DB::table('sections')->where('id', $sectionId)->update([
            'name' => $data['name'],
            'semester_id' => $data['semesterId'],
            'updated_at' => now(),
        ]);

        return response()->json(['section' => DB::table('sections')->where('id', $sectionId)->first()]);
    }

    public function deleteSection(string $sectionId)
    {
        $this->guardSeed($sectionId);
        DB::transaction(fn () => $this->deleteSectionRows($sectionId));

        return response()->json(['message' => 'Section deleted']);
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

        $teacherId = $this->teacherId($request);
        $code = strtoupper($data['code']);
        $existing = DB::table('subjects')
            ->join('subject_teacher', 'subject_teacher.subject_id', '=', 'subjects.id')
            ->where('subject_teacher.teacher_id', $teacherId)
            ->where('subjects.code', $code)
            ->select('subjects.*')
            ->first();
        $subjectId = $existing->id ?? $this->ownedId('sub', $teacherId, $code);

        DB::table('subjects')->updateOrInsert(['id' => $subjectId], [
            'id' => $subjectId,
            'name' => $data['name'],
            'code' => $code,
            'department_id' => $data['departmentId'] ?? 'seed-department-1',
            'semester_id' => $data['semesterId'] ?? 'seed-semester-1',
            'section_id' => $data['sectionId'] ?? 'seed-section-1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $subject = DB::table('subjects')->where('id', $subjectId)->first();
        DB::table('subject_teacher')->updateOrInsert([
            'subject_id' => $subject->id,
            'teacher_id' => $teacherId,
        ]);
        DB::table('section_teacher')->updateOrInsert([
            'section_id' => $subject->section_id,
            'teacher_id' => $teacherId,
        ]);

        return response()->json(['subject' => $subject], 201);
    }

    public function enrollStudents(Request $request)
    {
        $data = $request->validate([
            'subjectId' => ['required', 'string'],
            'semesterId' => ['required', 'string'],
            'studentIds' => ['present', 'array'],
            'studentIds.*' => ['required', 'string'],
        ]);

        $teacherId = $this->teacherId($request);
        if (!in_array($data['subjectId'], DB::table('subject_teacher')->where('teacher_id', $teacherId)->pluck('subject_id')->all(), true)) {
            return response()->json(['message' => 'Selected paper does not belong to this faculty account'], 403);
        }

        $studentIds = collect($data['studentIds'])->filter()->unique()->values()->all();
        $allowedStudentIds = DB::table('students')
            ->whereIn('id', $studentIds ?: [''])
            ->where('semester_id', $data['semesterId'])
            ->pluck('id')
            ->all();

        DB::transaction(function () use ($data, $allowedStudentIds) {
            DB::table('student_subject_enrollments')
                ->where('subject_id', $data['subjectId'])
                ->where('semester_id', $data['semesterId'])
                ->delete();

            foreach ($allowedStudentIds as $studentId) {
                DB::table('student_subject_enrollments')->insert([
                    'id' => substr('enr-'.sha1($data['subjectId'].'-'.$studentId), 0, 40),
                    'student_id' => $studentId,
                    'subject_id' => $data['subjectId'],
                    'semester_id' => $data['semesterId'],
                    'created_at' => now(),
                ]);
            }
        });

        return response()->json(['message' => 'Students mapped', 'count' => count($allowedStudentIds), 'studentIds' => $allowedStudentIds]);
    }

    public function updateSubject(Request $request, string $subjectId)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'min:2'],
            'name' => ['required', 'string', 'min:2'],
            'departmentId' => ['nullable', 'string'],
            'semesterId' => ['nullable', 'string'],
            'sectionId' => ['nullable', 'string'],
        ]);

        $subject = DB::table('subjects')->where('id', $subjectId)->first();
        if (!$subject) {
            return response()->json(['message' => 'Subject not found'], 404);
        }

        DB::table('subjects')->where('id', $subjectId)->update([
            'code' => strtoupper($data['code']),
            'name' => $data['name'],
            'department_id' => $data['departmentId'] ?? $subject->department_id,
            'semester_id' => $data['semesterId'] ?? $subject->semester_id,
            'section_id' => $data['sectionId'] ?? $subject->section_id,
            'updated_at' => now(),
        ]);

        return response()->json(['subject' => DB::table('subjects')->where('id', $subjectId)->first()]);
    }

    public function deleteSubject(string $subjectId)
    {
        $this->guardSeed($subjectId);
        DB::transaction(function () use ($subjectId) {
            $this->deleteSubjectRows($subjectId);
        });

        return response()->json(['message' => 'Subject deleted']);
    }

    private function teacherId(Request $request): string
    {
        $auth = $request->attributes->get('auth');
        return DB::table('teachers')->where('user_id', $auth['sub'] ?? null)->value('id') ?? 'seed-teacher-1';
    }

    private function isAdmin(Request $request): bool
    {
        $auth = $request->attributes->get('auth');
        return in_array($auth['role'] ?? '', ['ADMIN', 'SUPER_ADMIN'], true);
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

    private function ensureCourse(string $teacherId): string
    {
        $departmentId = DB::table('teachers')->where('id', $teacherId)->value('department_id') ?? $this->ensureDepartment('General');
        $courseId = 'course-'.substr($teacherId, -24);
        DB::table('courses')->updateOrInsert(['id' => $courseId], [
            'name' => 'General Course',
            'code' => 'GEN-'.strtoupper(substr($teacherId, -8)),
            'department_id' => $departmentId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $courseId;
    }

    private function ownedId(string $prefix, string $teacherId, string $value): string
    {
        return $prefix.'-'.substr($teacherId, -8).'-'.substr(sha1($value), 0, 12);
    }

    private function guardSeed(string $id): void
    {
        foreach ($this->protectedPrefixes as $prefix) {
            if (str_starts_with($id, $prefix)) {
                abort(response()->json(['message' => 'Seed records are protected'], 403));
            }
        }
    }

    private function deleteCourseRows(string $courseId): void
    {
        $semesterIds = DB::table('semesters')->where('course_id', $courseId)->pluck('id')->all();
        foreach ($semesterIds as $semesterId) {
            $this->deleteSemesterRows($semesterId);
        }
        DB::table('students')->where('course_id', $courseId)->pluck('user_id')->each(fn ($userId) => DB::table('users')->where('id', $userId)->delete());
        DB::table('courses')->where('id', $courseId)->delete();
    }

    private function deleteSemesterRows(string $semesterId): void
    {
        $sectionIds = DB::table('sections')->where('semester_id', $semesterId)->pluck('id')->all();
        foreach ($sectionIds as $sectionId) {
            $this->deleteSectionRows($sectionId);
        }
        DB::table('student_subject_enrollments')->where('semester_id', $semesterId)->delete();
        DB::table('semesters')->where('id', $semesterId)->delete();
    }

    private function deleteSectionRows(string $sectionId): void
    {
        $subjectIds = DB::table('subjects')->where('section_id', $sectionId)->pluck('id')->all();
        foreach ($subjectIds as $subjectId) {
            $this->deleteSubjectRows($subjectId);
        }
        $studentUserIds = DB::table('students')->where('section_id', $sectionId)->pluck('user_id')->all();
        DB::table('students')->where('section_id', $sectionId)->delete();
        DB::table('users')->whereIn('id', $studentUserIds)->delete();
        DB::table('section_teacher')->where('section_id', $sectionId)->delete();
        DB::table('sections')->where('id', $sectionId)->delete();
    }

    private function deleteSubjectRows(string $subjectId): void
    {
        $classSessionIds = DB::table('class_sessions')->where('subject_id', $subjectId)->pluck('id')->all();
        DB::table('class_diary_entries')->whereIn('class_session_id', $classSessionIds)->delete();
        DB::table('attendance')->where('subject_id', $subjectId)->delete();
        DB::table('class_sessions')->where('subject_id', $subjectId)->delete();
        DB::table('qr_attendance_sessions')->where('subject_id', $subjectId)->delete();
        DB::table('subject_teacher')->where('subject_id', $subjectId)->delete();
        DB::table('student_subject_enrollments')->where('subject_id', $subjectId)->delete();
        DB::table('subjects')->where('id', $subjectId)->delete();
    }
}
