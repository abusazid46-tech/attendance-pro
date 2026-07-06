<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class QrAttendanceController
{
    public function createSession(Request $request)
    {
        $data = $request->validate([
            'teacherId' => ['required', 'string'],
            'subjectId' => ['required', 'string'],
            'sectionId' => ['required', 'string'],
        ]);

        $token = Str::random(48);
        $id = (string) Str::ulid();
        DB::table('qr_attendance_sessions')->insert([
            'id' => $id,
            'token_hash' => Hash::make($token),
            'teacher_id' => $data['teacherId'],
            'subject_id' => $data['subjectId'],
            'section_id' => $data['sectionId'],
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);

        return response()->json(['sessionId' => $id, 'token' => $token, 'expiresAt' => now()->addMinutes(5)->toIso8601String()], 201);
    }

    public function scan(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'studentId' => ['required', 'string'],
            'teacherId' => ['required', 'string'],
            'subjectId' => ['required', 'string'],
            'departmentId' => ['required', 'string'],
            'courseId' => ['required', 'string'],
            'semesterId' => ['required', 'string'],
            'sectionId' => ['required', 'string'],
        ]);

        $sessions = DB::table('qr_attendance_sessions')->where('expires_at', '>', now())->get();
        $session = $sessions->first(fn ($item) => Hash::check($data['token'], $item->token_hash));
        if (!$session) {
            return response()->json(['message' => 'Invalid or expired QR token'], 400);
        }

        $id = (string) Str::ulid();
        DB::table('attendance')->updateOrInsert(
            ['student_id' => $data['studentId'], 'subject_id' => $data['subjectId'], 'date' => now()->toDateString()],
            [
                'id' => $id,
                'teacher_id' => $data['teacherId'],
                'department_id' => $data['departmentId'],
                'course_id' => $data['courseId'],
                'semester_id' => $data['semesterId'],
                'section_id' => $data['sectionId'],
                'status' => 'PRESENT',
                'source' => 'QR',
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return response()->json(['message' => 'QR attendance saved'], 201);
    }
}
