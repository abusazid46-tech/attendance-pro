<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AttendanceController
{
    public function students(Request $request)
    {
        $students = DB::table('students')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->leftJoin('sections', 'sections.id', '=', 'students.section_id')
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
            ->select('students.*', 'users.full_name', 'users.email', 'sections.name as section_name')
            ->orderByRaw('CAST(students.roll_number AS UNSIGNED), students.roll_number')
            ->get();

        return response()->json(['students' => $students]);
    }

    public function createClass(Request $request)
    {
        $data = $request->validate([
            'teacherId' => ['required', 'string'],
            'academicSessionId' => ['nullable', 'string'],
            'subjectId' => ['required', 'string'],
            'departmentId' => ['required', 'string'],
            'courseId' => ['required', 'string'],
            'semesterId' => ['required', 'string'],
            'sectionId' => ['required', 'string'],
            'date' => ['required', 'date'],
            'classNumber' => ['required', 'integer', 'min:1'],
            'topicTaught' => ['required', 'string', 'min:2'],
            'durationMinutes' => ['required', 'integer', 'min:1'],
            'assignmentGiven' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'observations' => ['nullable', 'string'],
        ]);

        $id = (string) Str::ulid();
        DB::transaction(function () use ($data, $id) {
            DB::table('class_sessions')->insert([
                'id' => $id,
                'teacher_id' => $data['teacherId'],
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
        $month = $request->month ? $request->month.'-01' : now()->format('Y-m-01');
        $start = date('Y-m-01', strtotime($month));
        $end = date('Y-m-01', strtotime($start.' +1 month'));

        $classes = DB::table('class_sessions')
            ->join('subjects', 'subjects.id', '=', 'class_sessions.subject_id')
            ->leftJoin('class_diary_entries', 'class_diary_entries.class_session_id', '=', 'class_sessions.id')
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
            'teacherId' => ['required', 'string'],
            'subjectId' => ['required', 'string'],
            'departmentId' => ['required', 'string'],
            'courseId' => ['required', 'string'],
            'semesterId' => ['required', 'string'],
            'sectionId' => ['required', 'string'],
            'date' => ['required', 'date'],
            'records' => ['required', 'array', 'min:1'],
            'records.*.studentId' => ['required', 'string'],
            'records.*.status' => ['required', 'in:PRESENT,ABSENT,LATE,LEAVE'],
            'records.*.remark' => ['nullable', 'string'],
            'records.*.offlineSyncId' => ['nullable', 'string'],
        ]);

        $saved = [];
        DB::transaction(function () use ($data, &$saved) {
            foreach ($data['records'] as $record) {
                $existing = DB::table('attendance')
                    ->when($record['offlineSyncId'] ?? null, fn ($q) => $q->where('offline_sync_id', $record['offlineSyncId']))
                    ->when(empty($record['offlineSyncId']), function ($q) use ($record, $data) {
                        $q->where('student_id', $record['studentId'])
                            ->where('subject_id', $data['subjectId'])
                            ->whereDate('date', $data['date']);
                    })
                    ->first();

                $payload = [
                    'class_session_id' => $data['classSessionId'] ?? null,
                    'teacher_id' => $data['teacherId'],
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

        $current = DB::table('attendance')->where('id', $attendanceId)->first();
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
}
