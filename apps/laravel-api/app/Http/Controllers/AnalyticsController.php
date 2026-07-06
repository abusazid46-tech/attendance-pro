<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;

class AnalyticsController
{
    public function facultyDashboard()
    {
        $totalRecords = DB::table('attendance')->count();
        $presentRecords = DB::table('attendance')->where('status', 'PRESENT')->count();
        $absentRecords = DB::table('attendance')->where('status', 'ABSENT')->count();
        $attendancePercentage = $totalRecords ? (int) round(($presentRecords / $totalRecords) * 100) : 0;

        return response()->json([
            'cards' => [
                'todayClasses' => DB::table('class_sessions')->whereDate('date', now()->toDateString())->count(),
                'totalStudents' => DB::table('students')->count(),
                'attendancePercentage' => $attendancePercentage,
                'pendingAttendance' => DB::table('class_sessions')->where('status', 'ATTENDANCE_PENDING')->count(),
            ],
            'teacherAnalytics' => [
                'totalClassesConducted' => DB::table('class_sessions')->count(),
                'attendanceAverage' => $attendancePercentage,
                'studentsBelowThreshold' => DB::table('students')->count(),
                'topPerformingSections' => [['section' => 'A', 'percentage' => 92]],
                'subjectPerformance' => [['subject' => 'Information Sources', 'percentage' => 88]],
            ],
            'charts' => [
                'presentVsAbsent' => [
                    ['name' => 'Present', 'value' => $presentRecords],
                    ['name' => 'Absent', 'value' => $absentRecords],
                ],
                'monthlyTrend' => [['month' => 'Jun', 'percentage' => 88]],
                'subjectWise' => [['subject' => 'LIS202', 'percentage' => 88]],
                'heatmap' => [['day' => 'Mon', 'value' => 86]],
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
}
