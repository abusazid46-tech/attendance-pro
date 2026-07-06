<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LeaveController
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'studentId' => ['required', 'string'],
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date'],
            'reason' => ['required', 'string'],
            'documentUrl' => ['nullable', 'string'],
        ]);

        $id = (string) Str::ulid();
        DB::table('leave_requests')->insert([
            'id' => $id,
            'student_id' => $data['studentId'],
            'start_date' => $data['startDate'],
            'end_date' => $data['endDate'],
            'reason' => $data['reason'],
            'document_url' => $data['documentUrl'] ?? null,
            'status' => 'PENDING',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Leave request created', 'leaveRequest' => DB::table('leave_requests')->where('id', $id)->first()], 201);
    }
}
