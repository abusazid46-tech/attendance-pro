<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReportsController
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'type' => ['required', 'string'],
            'format' => ['required', 'in:PDF,EXCEL'],
            'title' => ['required', 'string'],
            'filters' => ['nullable', 'array'],
        ]);

        $auth = $request->attributes->get('auth');
        $teacherId = DB::table('teachers')->where('user_id', $auth['sub'] ?? null)->value('id') ?? 'seed-teacher-1';
        $id = (string) Str::ulid();

        DB::table('generated_reports')->insert([
            'id' => $id,
            'teacher_id' => $teacherId,
            'type' => $data['type'],
            'format' => $data['format'],
            'title' => $data['title'],
            'filters' => json_encode($data['filters'] ?? []),
            'generated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Report queued',
            'report' => DB::table('generated_reports')->where('id', $id)->first(),
        ], 201);
    }

    public function daily(Request $request)
    {
        $date = $request->query('date', now()->toDateString());
        $records = DB::table('attendance')
            ->join('students', 'students.id', '=', 'attendance.student_id')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->join('subjects', 'subjects.id', '=', 'attendance.subject_id')
            ->whereDate('attendance.date', $date)
            ->select('attendance.date', 'users.full_name', 'students.roll_number', 'subjects.code as subject_code', 'attendance.status')
            ->orderBy('students.roll_number')
            ->get();

        return response()->json(['date' => $date, 'records' => $records]);
    }
}
