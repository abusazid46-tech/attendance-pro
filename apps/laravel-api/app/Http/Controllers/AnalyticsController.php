<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController
{
    public function facultyDashboard(Request $request)
    {
        $auth = $request->attributes->get('auth');
        $role = $auth['role'] ?? null;
        $teacherId = DB::table('teachers')->where('user_id', $auth['sub'] ?? null)->value('id');
        $isFaculty = $role === 'FACULTY' && $teacherId;

        $attendanceQuery = DB::table('attendance')
            ->where('id', 'not like', 'seed-%')
            ->when($isFaculty, fn ($q) => $q->where('teacher_id', $teacherId));
        $classQuery = DB::table('class_sessions')->when($isFaculty, fn ($q) => $q->where('teacher_id', $teacherId));

        $totalRecords = (clone $attendanceQuery)->count();
        $presentRecords = (clone $attendanceQuery)->where('status', 'PRESENT')->count();
        $absentRecords = (clone $attendanceQuery)->where('status', 'ABSENT')->count();
        $attendancePercentage = $totalRecords ? (int) round(($presentRecords / $totalRecords) * 100) : 0;
        $teacherSectionIds = $teacherId ? $this->teacherSectionIds($teacherId) : [];
        $teacherSubjectIds = $teacherId ? $this->teacherSubjectIds($teacherId) : [];
        $studentQuery = DB::table('students')
            ->where('students.id', 'not like', 'seed-%')
            ->when($isFaculty, function ($q) use ($teacherSectionIds, $teacherSubjectIds, $teacherId) {
                $q->where(function ($inner) use ($teacherSectionIds, $teacherSubjectIds, $teacherId) {
                    $inner->whereIn('students.section_id', $teacherSectionIds ?: [''])
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
            });
        $teacherProfile = $teacherId ? DB::table('teachers')
            ->join('users', 'users.id', '=', 'teachers.user_id')
            ->leftJoin('departments', 'departments.id', '=', 'teachers.department_id')
            ->leftJoin('academic_sessions', 'academic_sessions.teacher_id', '=', 'teachers.id')
            ->where('teachers.id', $teacherId)
            ->select(
                'teachers.id as teacherId',
                'users.full_name as name',
                'users.email',
                'users.avatar_url as avatarUrl',
                'users.mobile_number as mobileNumber',
                'teachers.designation',
                'teachers.institution_name as institutionName',
                'departments.name as department',
                'academic_sessions.name as academicSession'
            )
            ->orderByDesc('academic_sessions.created_at')
            ->first() : null;

        return response()->json([
            'teacherProfile' => $teacherProfile,
            'cards' => [
                'todayClasses' => (clone $classQuery)->whereDate('date', now()->toDateString())->count(),
                'totalStudents' => (clone $studentQuery)->count(),
                'attendancePercentage' => $attendancePercentage,
                'pendingAttendance' => (clone $classQuery)->where('status', 'ATTENDANCE_PENDING')->count(),
            ],
            'teacherAnalytics' => [
                'totalClassesConducted' => (clone $classQuery)->count(),
                'attendanceAverage' => $attendancePercentage,
                'studentsBelowThreshold' => 0,
                'topPerformingSections' => [],
                'subjectPerformance' => $this->subjectPerformance($isFaculty ? $teacherId : null),
            ],
            'charts' => [
                'presentVsAbsent' => [
                    ['name' => 'Present', 'value' => $presentRecords],
                    ['name' => 'Absent', 'value' => $absentRecords],
                ],
                'monthlyTrend' => $this->monthlyTrend($isFaculty ? $teacherId : null),
                'subjectWise' => $this->subjectPerformance($isFaculty ? $teacherId : null),
                'heatmap' => [],
            ],
        ]);
    }

    public function student(string $studentId)
    {
        $records = DB::table('attendance')
            ->join('subjects', 'subjects.id', '=', 'attendance.subject_id')
            ->where('attendance.student_id', $studentId)
            ->select('attendance.*', 'subjects.name as subject_name')
            ->get();

        $total = $records->count();
        $present = $records->where('status', 'PRESENT')->count();
        $absent = $records->where('status', 'ABSENT')->count();
        $bySubject = $records->groupBy('subject_id')->map(function ($items) {
            $total = $items->count();
            $present = $items->where('status', 'PRESENT')->count();
            return [
                'subject' => $items->first()->subject_name,
                'total' => $total,
                'present' => $present,
                'percentage' => $total ? (int) round(($present / $total) * 100) : 0,
            ];
        })->values();

        return response()->json([
            'overallAttendancePercentage' => $total ? (int) round(($present / $total) * 100) : 0,
            'subjectWiseAttendance' => $bySubject,
            'totalPresent' => $present,
            'totalAbsent' => $absent,
            'totalClasses' => $total,
        ]);
    }

    private function monthlyTrend(?string $teacherId): array
    {
        return DB::table('attendance')
            ->where('attendance.id', 'not like', 'seed-%')
            ->selectRaw("DATE_FORMAT(date, '%b') as month")
            ->selectRaw("SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_count")
            ->selectRaw('COUNT(*) as total_count')
            ->when($teacherId, fn ($q) => $q->where('teacher_id', $teacherId))
            ->groupByRaw("DATE_FORMAT(date, '%Y-%m'), DATE_FORMAT(date, '%b')")
            ->orderByRaw("MIN(date)")
            ->get()
            ->map(fn ($item) => [
                'month' => $item->month,
                'percentage' => $item->total_count ? (int) round(($item->present_count / $item->total_count) * 100) : 0,
            ])
            ->all();
    }

    private function subjectPerformance(?string $teacherId): array
    {
        return DB::table('attendance')
            ->join('subjects', 'subjects.id', '=', 'attendance.subject_id')
            ->where('attendance.id', 'not like', 'seed-%')
            ->select('subjects.code as subject')
            ->selectRaw("SUM(CASE WHEN attendance.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count")
            ->selectRaw('COUNT(*) as total_count')
            ->when($teacherId, fn ($q) => $q->where('attendance.teacher_id', $teacherId))
            ->groupBy('subjects.code')
            ->orderBy('subjects.code')
            ->get()
            ->map(fn ($item) => [
                'subject' => $item->subject,
                'percentage' => $item->total_count ? (int) round(($item->present_count / $item->total_count) * 100) : 0,
            ])
            ->all();
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
}
