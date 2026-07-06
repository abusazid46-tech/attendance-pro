<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BackupsController
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'target' => ['required', 'in:GOOGLE_DRIVE,LOCAL_STORAGE'],
            'metadata' => ['nullable', 'array'],
        ]);

        $auth = $request->attributes->get('auth');
        $teacherId = DB::table('teachers')->where('user_id', $auth['sub'] ?? null)->value('id') ?? 'seed-teacher-1';
        $id = (string) Str::ulid();

        DB::table('backup_snapshots')->insert([
            'id' => $id,
            'teacher_id' => $teacherId,
            'target' => $data['target'],
            'status' => 'COMPLETED',
            'metadata' => json_encode($data['metadata'] ?? []),
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => 'Backup snapshot recorded',
            'backup' => DB::table('backup_snapshots')->where('id', $id)->first(),
        ], 201);
    }
}
