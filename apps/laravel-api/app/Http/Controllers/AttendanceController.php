<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AttendanceController
{
    public function index(Request $request)
    {
        $teacherId = $this->teacherId($request);
        $records = DB::table('attendance')
            ->join('students', 'students.id', '=', 'attendance.student_id')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->join('subjects', 'subjects.id', '=', 'attendance.subject_id')
            ->leftJoin('class_sessions', 'class_sessions.id', '=', 'attendance.class_session_id')
            ->where('attendance.id', 'not like', 'seed-%')
            ->where('attendance.teacher_id', $teacherId)
            ->when($request->date, fn ($q) => $q->whereDate('attendance.date', $request->date))
            ->when($request->subjectId, fn ($q) => $q->where('attendance.subject_id', $request->subjectId))
            ->when($request->semesterId, fn ($q) => $q->where('attendance.semester_id', $request->semesterId))
            ->when($request->classSessionId, fn ($q) => $q->where('attendance.class_session_id', $request->classSessionId))
            ->select(
                'attendance.*',
                'students.roll_number',
                'users.full_name',
                'subjects.code as subject_code',
                'subjects.name as subject_name',
                'class_sessions.class_number',
                'class_sessions.topic_taught'
            )
            ->orderByDesc('attendance.date')
            ->orderByRaw('CAST(students.roll_number AS UNSIGNED), students.roll_number')
            ->get();

        return response()->json(['records' => $records]);
    }

    public function students(Request $request)
    {
        $teacherId = $this->teacherId($request);
        $isAdmin = $this->isAdmin($request);
        $teacherSubjectIds = $this->teacherSubjectIds($teacherId);
        $teacherSectionIds = $this->teacherSectionIds($teacherId);
        if (!$isAdmin && $request->subjectId && !in_array($request->subjectId, $teacherSubjectIds, true)) {
            return response()->json(['students' => []]);
        }

        $attendanceSummary = DB::table('attendance')
            ->where('id', 'not like', 'seed-%')
            ->when(!$isAdmin, fn ($q) => $q->where('teacher_id', $teacherId))
            ->when($request->subjectId, fn ($q) => $q->where('subject_id', $request->subjectId))
            ->select('student_id')
            ->selectRaw("SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present")
            ->selectRaw("SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent")
            ->selectRaw("SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late")
            ->selectRaw("SUM(CASE WHEN status = 'LEAVE' THEN 1 ELSE 0 END) as leave_count")
            ->selectRaw('COUNT(*) as total')
            ->groupBy('student_id');

        $students = DB::table('students')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->leftJoin('sections', 'sections.id', '=', 'students.section_id')
            ->leftJoinSub($attendanceSummary, 'attendance_summary', fn ($join) => $join->on('attendance_summary.student_id', '=', 'students.id'))
            ->where('students.id', 'not like', 'seed-%')
            ->when(!$isAdmin, function ($q) use ($teacherSectionIds, $teacherSubjectIds, $teacherId) {
                $q->where(function ($scope) use ($teacherSectionIds, $teacherSubjectIds, $teacherId) {
                    $scope->whereIn('students.section_id', $teacherSectionIds ?: [''])
                        ->orWhereIn('students.id', function ($sub) use ($teacherSubjectIds) {
                            $sub->select('student_id')
                                ->from('student_subject_enrollments')
                                ->whereIn('subject_id', $teacherSubjectIds ?: ['']);
                        })
                        ->orWhereIn('students.id', function ($sub) use ($teacherId) {
                            $sub->select('student_id')
                                ->from('attendance')
                                ->where('teacher_id', $teacherId);
                        });
                });
            })
            ->when($request->departmentId, fn ($q) => $q->where('students.department_id', $request->departmentId))
            ->when($request->semesterId, fn ($q) => $q->where('students.semester_id', $request->semesterId))
            ->when($request->sectionId, fn ($q) => $q->where('students.section_id', $request->sectionId))
            ->when($request->search, function ($q) use ($request) {
                $q->where(function ($inner) use ($request) {
                    $term = '%'.$request->search.'%';
                    $inner->where('users.full_name', 'like', $term)
                        ->orWhere('students.roll_number', 'like', $term)
                        ->orWhere('students.registration_number', 'like', $term);
                });
            })
            ->select(
                'students.*',
                'users.full_name',
                'users.email',
                'sections.name as section_name',
                DB::raw('COALESCE(attendance_summary.present, 0) as present'),
                DB::raw('COALESCE(attendance_summary.absent, 0) as absent'),
                DB::raw('COALESCE(attendance_summary.late, 0) as late'),
                DB::raw('COALESCE(attendance_summary.leave_count, 0) as leave_count'),
                DB::raw('COALESCE(attendance_summary.total, 0) as total'),
                DB::raw('CASE WHEN COALESCE(attendance_summary.total, 0) = 0 THEN 0 ELSE ROUND((attendance_summary.present / attendance_summary.total) * 100) END as attendance')
            )
            ->orderByRaw('CAST(students.roll_number AS UNSIGNED), students.roll_number')
            ->get();

        $studentIds = $students->pluck('id')->all();
        $enrollments = DB::table('student_subject_enrollments')
            ->whereIn('student_id', $studentIds ?: [''])
            ->get(['student_id', 'subject_id'])
            ->groupBy('student_id');

        $students = $students->map(function ($student) use ($enrollments) {
            $student->enrolled_subject_ids = $enrollments->get($student->id, collect())->pluck('subject_id')->values()->all();
            return $student;
        });

        return response()->json(['students' => $students]);
    }

    public function studentRecords(Request $request, string $studentId)
    {
        $teacherId = $this->teacherId($request);
        $student = DB::table('students')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->where('students.id', $studentId)
            ->where('students.id', 'not like', 'seed-%')
            ->where(function ($q) use ($teacherId) {
                $q->whereIn('students.section_id', $this->teacherSectionIds($teacherId) ?: [''])
                    ->orWhereIn('students.id', function ($sub) use ($teacherId) {
                        $sub->select('student_id')
                            ->from('attendance')
                            ->where('teacher_id', $teacherId);
                    });
            })
            ->select('students.*', 'users.full_name', 'users.email')
            ->first();

        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }

        $records = DB::table('attendance')
            ->join('subjects', 'subjects.id', '=', 'attendance.subject_id')
            ->leftJoin('class_sessions', 'class_sessions.id', '=', 'attendance.class_session_id')
            ->where('attendance.student_id', $studentId)
            ->where('attendance.id', 'not like', 'seed-%')
            ->where('attendance.teacher_id', $teacherId)
            ->when($request->subjectId, fn ($q) => $q->where('attendance.subject_id', $request->subjectId))
            ->select(
                'attendance.id',
                'attendance.date',
                'attendance.status',
                'attendance.remark',
                'attendance.subject_id',
                'subjects.code as subject_code',
                'subjects.name as subject_name',
                'class_sessions.class_number',
                'class_sessions.topic_taught'
            )
            ->orderByDesc('attendance.date')
            ->get();

        $total = $records->count();
        $present = $records->where('status', 'PRESENT')->count();

        return response()->json([
            'student' => $student,
            'summary' => [
                'present' => $present,
                'absent' => $records->where('status', 'ABSENT')->count(),
                'late' => $records->where('status', 'LATE')->count(),
                'leave' => $records->where('status', 'LEAVE')->count(),
                'total' => $total,
                'attendance' => $total ? (int) round(($present / $total) * 100) : 0,
            ],
            'records' => $records,
        ]);
    }

    public function deleteStudent(Request $request, string $studentId)
    {
        $teacherId = $this->teacherId($request);
        $student = DB::table('students')
            ->where('id', $studentId)
            ->where('id', 'not like', 'seed-%')
            ->whereIn('section_id', $this->teacherSectionIds($teacherId) ?: [''])
            ->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }

        DB::transaction(function () use ($student) {
            DB::table('attendance')->where('student_id', $student->id)->delete();
            DB::table('student_subject_enrollments')->where('student_id', $student->id)->delete();
            DB::table('students')->where('id', $student->id)->delete();
            DB::table('users')->where('id', $student->user_id)->delete();
        });

        return response()->json(['message' => 'Student removed']);
    }

    public function updateStudent(Request $request, string $studentId)
    {
        $data = $request->validate([
            'rollNumber' => ['required', 'string'],
            'name' => ['required', 'string', 'min:2'],
            'email' => ['nullable', 'email'],
            'departmentId' => ['required', 'string'],
            'courseId' => ['required', 'string'],
            'semesterId' => ['required', 'string'],
            'sectionId' => ['required', 'string'],
        ]);
        $teacherId = $this->teacherId($request);
        $student = DB::table('students')
            ->where('id', $studentId)
            ->where('id', 'not like', 'seed-%')
            ->whereIn('section_id', $this->teacherSectionIds($teacherId) ?: [''])
            ->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }
        $this->assertTeacherOwnsSection($request, $data['sectionId']);

        $duplicate = DB::table('students')
            ->where('section_id', $data['sectionId'])
            ->where('roll_number', $data['rollNumber'])
            ->where('id', '!=', $studentId)
            ->first();
        if ($duplicate) {
            return response()->json(['message' => 'Roll number already exists in this section'], 422);
        }

        DB::transaction(function () use ($data, $student, $studentId) {
            DB::table('users')->where('id', $student->user_id)->update([
                'full_name' => $data['name'],
                'email' => $data['email'] ?? $studentId.'@attendance.local',
                'updated_at' => now(),
            ]);
            DB::table('students')->where('id', $studentId)->update([
                'roll_number' => $data['rollNumber'],
                'registration_number' => 'REG-'.$data['sectionId'].'-'.$data['rollNumber'],
                'department_id' => $data['departmentId'],
                'course_id' => $data['courseId'],
                'semester_id' => $data['semesterId'],
                'section_id' => $data['sectionId'],
                'updated_at' => now(),
            ]);
        });

        return response()->json([
            'message' => 'Student updated',
            'student' => DB::table('students')
                ->join('users', 'users.id', '=', 'students.user_id')
                ->where('students.id', $studentId)
                ->select('students.*', 'users.full_name', 'users.email')
                ->first(),
        ]);
    }

    public function createStudent(Request $request)
    {
        $data = $request->validate([
            'rollNumber' => ['required', 'string'],
            'name' => ['required', 'string', 'min:2'],
            'email' => ['nullable', 'email'],
            'departmentId' => ['required', 'string'],
            'courseId' => ['required', 'string'],
            'semesterId' => ['required', 'string'],
            'sectionId' => ['required', 'string'],
        ]);
        $this->assertTeacherOwnsSection($request, $data['sectionId']);

        $student = $this->upsertStudent($data);
        return response()->json(['student' => $student], 201);
    }

    public function bulkStudents(Request $request)
    {
        $data = $request->validate([
            'students' => ['required', 'array', 'min:1'],
            'students.*.rollNumber' => ['required', 'string'],
            'students.*.name' => ['required', 'string', 'min:2'],
            'students.*.email' => ['nullable', 'email'],
            'departmentId' => ['required', 'string'],
            'courseId' => ['required', 'string'],
            'semesterId' => ['required', 'string'],
            'sectionId' => ['required', 'string'],
        ]);
        $this->assertTeacherOwnsSection($request, $data['sectionId']);

        $saved = [];
        foreach ($data['students'] as $student) {
            $saved[] = $this->upsertStudent($student + [
                'departmentId' => $data['departmentId'],
                'courseId' => $data['courseId'],
                'semesterId' => $data['semesterId'],
                'sectionId' => $data['sectionId'],
            ]);
        }

        return response()->json(['message' => 'Students saved', 'count' => count($saved), 'students' => $saved], 201);
    }

    public function createClass(Request $request)
    {
        $data = $request->validate([
            'teacherId' => ['nullable', 'string'],
            'academicSessionId' => ['nullable', 'string'],
            'subjectId' => ['required', 'string'],
            'departmentId' => ['nullable', 'string'],
            'courseId' => ['nullable', 'string'],
            'semesterId' => ['nullable', 'string'],
            'sectionId' => ['nullable', 'string'],
            'date' => ['required', 'date'],
            'classNumber' => ['required', 'integer', 'min:1'],
            'topicTaught' => ['required', 'string', 'min:2'],
            'durationMinutes' => ['required', 'integer', 'min:1'],
            'assignmentGiven' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'observations' => ['nullable', 'string'],
        ]);
        $data = $this->resolveAcademicContext($data);

        $teacherId = $this->teacherId($request, $data['teacherId'] ?? null);
        $this->assertTeacherOwnsSubject($teacherId, $data['subjectId']);
        $existing = DB::table('class_sessions')
            ->where('subject_id', $data['subjectId'])
            ->whereDate('date', $data['date'])
            ->where('class_number', $data['classNumber'])
            ->first();

        if ($existing) {
            DB::transaction(function () use ($data, $existing, $teacherId) {
                DB::table('class_sessions')->where('id', $existing->id)->update([
                    'teacher_id' => $teacherId,
                    'academic_session_id' => $data['academicSessionId'] ?? $existing->academic_session_id,
                    'department_id' => $data['departmentId'],
                    'course_id' => $data['courseId'],
                    'semester_id' => $data['semesterId'],
                    'section_id' => $data['sectionId'],
                    'topic_taught' => $data['topicTaught'],
                    'duration_minutes' => $data['durationMinutes'],
                    'status' => $existing->status === 'ATTENDANCE_COMPLETED' ? 'ATTENDANCE_COMPLETED' : 'ATTENDANCE_PENDING',
                    'updated_at' => now(),
                ]);

                DB::table('class_diary_entries')->updateOrInsert(
                    ['class_session_id' => $existing->id],
                    [
                        'id' => DB::table('class_diary_entries')->where('class_session_id', $existing->id)->value('id') ?? (string) Str::ulid(),
                        'topic_taught' => $data['topicTaught'],
                        'assignment_given' => $data['assignmentGiven'] ?? null,
                        'notes' => $data['notes'] ?? null,
                        'observations' => $data['observations'] ?? null,
                        'created_at' => DB::table('class_diary_entries')->where('class_session_id', $existing->id)->value('created_at') ?? now(),
                        'updated_at' => now(),
                    ]
                );
            });

            return response()->json(['classSession' => DB::table('class_sessions')->where('id', $existing->id)->first()]);
        }

        $id = (string) Str::ulid();
        DB::transaction(function () use ($data, $id, $teacherId) {
            DB::table('class_sessions')->insert([
                'id' => $id,
                'teacher_id' => $teacherId,
                'academic_session_id' => $data['academicSessionId'] ?? null,
                'subject_id' => $data['subjectId'],
                'department_id' => $data['departmentId'],
                'course_id' => $data['courseId'],
                'semester_id' => $data['semesterId'],
                'section_id' => $data['sectionId'],
                'date' => $data['date'],
                'class_number' => $data['classNumber'],
                'topic_taught' => $data['topicTaught'],
                'duration_minutes' => $data['durationMinutes'],
                'status' => 'ATTENDANCE_PENDING',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('class_diary_entries')->insert([
                'id' => (string) Str::ulid(),
                'class_session_id' => $id,
                'topic_taught' => $data['topicTaught'],
                'assignment_given' => $data['assignmentGiven'] ?? null,
                'notes' => $data['notes'] ?? null,
                'observations' => $data['observations'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json(['classSession' => DB::table('class_sessions')->where('id', $id)->first()], 201);
    }

    public function calendar(Request $request)
    {
        $teacherId = $this->teacherId($request);
        $month = $request->month ? $request->month.'-01' : now()->format('Y-m-01');
        $start = date('Y-m-01', strtotime($month));
        $end = date('Y-m-01', strtotime($start.' +1 month'));

        $classes = DB::table('class_sessions')
            ->join('subjects', 'subjects.id', '=', 'class_sessions.subject_id')
            ->leftJoin('class_diary_entries', 'class_diary_entries.class_session_id', '=', 'class_sessions.id')
            ->where('class_sessions.teacher_id', $teacherId)
            ->when($request->subjectId, fn ($q) => $q->where('class_sessions.subject_id', $request->subjectId))
            ->where('class_sessions.date', '>=', $start)
            ->where('class_sessions.date', '<', $end)
            ->select('class_sessions.*', 'subjects.code as subject_code', 'class_diary_entries.notes')
            ->orderBy('class_sessions.date')
            ->get();

        return response()->json(['days' => $classes]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'classSessionId' => ['nullable', 'string'],
            'teacherId' => ['nullable', 'string'],
            'subjectId' => ['required', 'string'],
            'departmentId' => ['nullable', 'string'],
            'courseId' => ['nullable', 'string'],
            'semesterId' => ['nullable', 'string'],
            'sectionId' => ['nullable', 'string'],
            'date' => ['required', 'date'],
            'records' => ['required', 'array', 'min:1'],
            'records.*.studentId' => ['required', 'string'],
            'records.*.status' => ['required', 'in:PRESENT,ABSENT,LATE,LEAVE'],
            'records.*.remark' => ['nullable', 'string'],
            'records.*.offlineSyncId' => ['nullable', 'string'],
        ]);
        $data = $this->resolveAcademicContext($data);

        $saved = [];
        $teacherId = $this->teacherId($request, $data['teacherId'] ?? null);
        $this->assertTeacherOwnsSubject($teacherId, $data['subjectId']);
        $this->assertTeacherCanMarkStudents($data);
        DB::transaction(function () use ($data, &$saved, $teacherId) {
            foreach ($data['records'] as $record) {
                $existing = DB::table('attendance')
                    ->where('teacher_id', $teacherId)
                    ->when($record['offlineSyncId'] ?? null, fn ($q) => $q->where('offline_sync_id', $record['offlineSyncId']))
                    ->when(empty($record['offlineSyncId']), function ($q) use ($record, $data) {
                        $q->where('student_id', $record['studentId'])
                            ->where('subject_id', $data['subjectId'])
                            ->whereDate('date', $data['date']);
                    })
                    ->first();

                $payload = [
                    'class_session_id' => $data['classSessionId'] ?? null,
                    'teacher_id' => $teacherId,
                    'subject_id' => $data['subjectId'],
                    'department_id' => $data['departmentId'],
                    'course_id' => $data['courseId'],
                    'semester_id' => $data['semesterId'],
                    'section_id' => $data['sectionId'],
                    'student_id' => $record['studentId'],
                    'date' => $data['date'],
                    'status' => $record['status'],
                    'remark' => $record['remark'] ?? null,
                    'offline_sync_id' => $record['offlineSyncId'] ?? null,
                    'source' => empty($record['offlineSyncId']) ? 'MANUAL' : 'OFFLINE_SYNC',
                    'updated_at' => now(),
                ];

                if ($existing) {
                    DB::table('attendance')->where('id', $existing->id)->update($payload);
                    $saved[] = $existing->id;
                } else {
                    $id = (string) Str::ulid();
                    DB::table('attendance')->insert($payload + ['id' => $id, 'created_at' => now()]);
                    $saved[] = $id;
                }
            }

            if (!empty($data['classSessionId'])) {
                DB::table('class_sessions')->where('id', $data['classSessionId'])->update(['status' => 'ATTENDANCE_COMPLETED', 'updated_at' => now()]);
            }
        });

        return response()->json(['message' => 'Attendance submitted', 'count' => count($saved), 'records' => $saved], 201);
    }

    public function update(Request $request, string $attendanceId)
    {
        $data = $request->validate([
            'status' => ['required', 'in:PRESENT,ABSENT,LATE,LEAVE'],
            'reason' => ['nullable', 'string'],
        ]);

        $teacherId = $this->teacherId($request);
        $current = DB::table('attendance')->where('id', $attendanceId)->where('teacher_id', $teacherId)->first();
        if (!$current) {
            return response()->json(['message' => 'Attendance record not found'], 404);
        }

        DB::table('attendance')->where('id', $attendanceId)->update([
            'status' => $data['status'],
            'remark' => $data['reason'] ?? null,
            'updated_at' => now(),
        ]);

        DB::table('audit_logs')->insert([
            'id' => (string) Str::ulid(),
            'entity_type' => 'Attendance',
            'entity_id' => $attendanceId,
            'attendance_id' => $attendanceId,
            'previous_value' => json_encode(['status' => $current->status]),
            'updated_value' => json_encode(['status' => $data['status']]),
            'updated_by_id' => request()->attributes->get('auth')['sub'] ?? $current->teacher_id,
            'reason' => $data['reason'] ?? null,
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Attendance updated', 'attendance' => DB::table('attendance')->where('id', $attendanceId)->first()]);
    }

    private function upsertStudent(array $data): object
    {
        $existing = DB::table('students')
            ->where('section_id', $data['sectionId'])
            ->where('roll_number', $data['rollNumber'])
            ->first();
        $hash = substr(sha1($data['sectionId'].'|'.$data['rollNumber']), 0, 24);
        $studentId = $existing->id ?? 'stu-'.$hash;
        $userId = $existing->user_id ?? 'usr-'.$hash;
        $email = $data['email'] ?? $studentId.'@attendance.local';

        DB::transaction(function () use ($data, $studentId, $userId, $email) {
            DB::table('users')->updateOrInsert(['id' => $userId], [
                'email' => $email,
                'mobile_number' => null,
                'password_hash' => bcrypt('Password@123'),
                'full_name' => $data['name'],
                'role_id' => DB::table('roles')->where('name', 'STUDENT')->value('id') ?? 'role-student',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('students')->updateOrInsert(['id' => $studentId], [
                'user_id' => $userId,
                'roll_number' => $data['rollNumber'],
                'registration_number' => 'REG-'.$data['sectionId'].'-'.$data['rollNumber'],
                'department_id' => $data['departmentId'],
                'course_id' => $data['courseId'],
                'semester_id' => $data['semesterId'],
                'section_id' => $data['sectionId'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return DB::table('students')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->where('students.id', $studentId)
            ->select('students.*', 'users.full_name', 'users.email')
            ->first();
    }

    private function teacherId(Request $request, ?string $fallback = null): string
    {
        $auth = $request->attributes->get('auth');
        $teacherId = DB::table('teachers')->where('user_id', $auth['sub'] ?? null)->value('id');

        return $teacherId ?? $fallback ?? 'seed-teacher-1';
    }

    private function teacherSubjectIds(string $teacherId): array
    {
        return DB::table('subject_teacher')->where('teacher_id', $teacherId)->pluck('subject_id')->all();
    }

    private function teacherSectionIds(string $teacherId): array
    {
        $direct = DB::table('section_teacher')->where('teacher_id', $teacherId)->pluck('section_id');
        $fromSubjects = DB::table('subjects')
            ->join('subject_teacher', 'subject_teacher.subject_id', '=', 'subjects.id')
            ->where('subject_teacher.teacher_id', $teacherId)
            ->pluck('subjects.section_id');

        return $direct->merge($fromSubjects)->filter()->unique()->values()->all();
    }

    private function isAdmin(Request $request): bool
    {
        $auth = $request->attributes->get('auth');
        return in_array($auth['role'] ?? '', ['ADMIN', 'SUPER_ADMIN'], true);
    }

    private function assertTeacherOwnsSection(Request $request, string $sectionId): void
    {
        $teacherId = $this->teacherId($request);
        if (!in_array($sectionId, $this->teacherSectionIds($teacherId), true)) {
            abort(response()->json(['message' => 'Selected section does not belong to this faculty account'], 403));
        }
    }

    private function assertTeacherOwnsSubject(string $teacherId, string $subjectId): void
    {
        if (!in_array($subjectId, $this->teacherSubjectIds($teacherId), true)) {
            abort(response()->json(['message' => 'Selected paper does not belong to this faculty account'], 403));
        }
    }

    private function assertTeacherCanMarkStudents(array $data): void
    {
        $studentIds = collect($data['records'])->pluck('studentId')->filter()->unique()->values()->all();
        $students = DB::table('students')
            ->whereIn('id', $studentIds ?: [''])
            ->get(['id', 'section_id'])
            ->keyBy('id');
        $enrolledStudentIds = DB::table('student_subject_enrollments')
            ->where('subject_id', $data['subjectId'])
            ->whereIn('student_id', $studentIds ?: [''])
            ->pluck('student_id')
            ->all();

        $invalid = [];
        foreach ($studentIds as $studentId) {
            $student = $students->get($studentId);
            $sameSection = $student && $student->section_id === $data['sectionId'];
            $enrolled = in_array($studentId, $enrolledStudentIds, true);
            if (!$student || (!$sameSection && !$enrolled)) {
                $invalid[] = $studentId;
            }
        }

        if ($invalid) {
            abort(response()->json([
                'message' => 'Some students are not linked to the selected paper or section',
                'invalidStudentIds' => $invalid,
            ], 422));
        }
    }

    private function resolveAcademicContext(array $data): array
    {
        $subject = DB::table('subjects')->where('id', $data['subjectId'])->first();
        if (!$subject) {
            abort(response()->json(['message' => 'Selected subject was not found'], 422));
        }

        $sectionId = $this->filled($data['sectionId'] ?? null) ? $data['sectionId'] : $subject->section_id;
        $semesterId = $this->filled($data['semesterId'] ?? null) ? $data['semesterId'] : $subject->semester_id;
        $section = $sectionId ? DB::table('sections')->where('id', $sectionId)->first() : null;
        $semesterId = $semesterId ?: ($section->semester_id ?? null);
        $semester = $semesterId ? DB::table('semesters')->where('id', $semesterId)->first() : null;

        $data['departmentId'] = $this->filled($data['departmentId'] ?? null) ? $data['departmentId'] : $subject->department_id;
        $data['courseId'] = $this->filled($data['courseId'] ?? null) ? $data['courseId'] : ($semester->course_id ?? null);
        $data['semesterId'] = $semesterId;
        $data['sectionId'] = $sectionId;

        foreach (['departmentId', 'courseId', 'semesterId', 'sectionId'] as $field) {
            if (!$this->filled($data[$field] ?? null)) {
                abort(response()->json(['message' => 'Academic setup is incomplete for attendance', 'missing' => $field], 422));
            }
        }

        return $data;
    }

    private function filled(?string $value): bool
    {
        return is_string($value) && trim($value) !== '';
    }
}
