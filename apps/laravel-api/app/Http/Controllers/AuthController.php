<?php

namespace App\Http\Controllers;

use App\Support\JwtService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController
{
    public function registerTeacher(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'mobileNumber' => ['required', 'string', 'min:7', 'max:30', 'unique:users,mobile_number'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'designation' => ['nullable', 'string', 'max:120'],
            'department' => ['required', 'string', 'min:2', 'max:160'],
            'institutionName' => ['required', 'string', 'min:2', 'max:190'],
            'employeeCode' => ['nullable', 'string', 'max:60', 'unique:teachers,employee_code'],
            'academicSession' => ['required', 'string', 'min:3', 'max:60'],
        ]);

        $teacher = null;
        $user = null;

        DB::transaction(function () use ($data, &$teacher, &$user) {
            $roleId = $this->ensureFacultyRole();
            $departmentId = $this->ensureDepartment($data['department']);
            $userId = (string) Str::ulid();
            $teacherId = (string) Str::ulid();
            $employeeCode = $data['employeeCode'] ?? 'FAC-'.strtoupper(substr((string) Str::ulid(), -8));

            DB::table('users')->insert([
                'id' => $userId,
                'email' => strtolower($data['email']),
                'mobile_number' => $data['mobileNumber'],
                'password_hash' => Hash::make($data['password']),
                'full_name' => $data['name'],
                'role_id' => $roleId,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('teachers')->insert([
                'id' => $teacherId,
                'user_id' => $userId,
                'employee_code' => $employeeCode,
                'designation' => $data['designation'] ?? null,
                'institution_name' => $data['institutionName'],
                'department_id' => $departmentId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('academic_sessions')->insert([
                'id' => (string) Str::ulid(),
                'name' => $data['academicSession'],
                'starts_on' => now()->startOfYear()->toDateString(),
                'ends_on' => now()->startOfYear()->addYear()->subDay()->toDateString(),
                'is_active' => true,
                'teacher_id' => $teacherId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $user = DB::table('users')
                ->join('roles', 'roles.id', '=', 'users.role_id')
                ->where('users.id', $userId)
                ->select('users.*', 'roles.name as role_name')
                ->first();
            $teacher = DB::table('teachers')->where('id', $teacherId)->first();
        });

        return response()->json($this->issueSession($user, ['teacher' => $teacher]), 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['nullable', 'email'],
            'mobileNumber' => ['nullable', 'string', 'min:7'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        if (empty($data['email']) && empty($data['mobileNumber'])) {
            return response()->json(['message' => 'Email or mobile number is required'], 422);
        }

        $user = DB::table('users')
            ->join('roles', 'roles.id', '=', 'users.role_id')
            ->where('users.is_active', true)
            ->where(function ($query) use ($data) {
                if (!empty($data['email'])) {
                    $query->orWhere('users.email', $data['email']);
                }
                if (!empty($data['mobileNumber'])) {
                    $query->orWhere('users.mobile_number', $data['mobileNumber']);
                }
            })
            ->select('users.*', 'roles.name as role_name')
            ->first();

        if (!$user || !Hash::check($data['password'], $user->password_hash)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        return response()->json($this->issueSession($user));
    }

    public function refresh(Request $request)
    {
        $data = $request->validate(['refreshToken' => ['required', 'string', 'min:20']]);
        $users = DB::table('users')
            ->join('roles', 'roles.id', '=', 'users.role_id')
            ->whereNotNull('refresh_token_hash')
            ->select('users.*', 'roles.name as role_name')
            ->get();

        foreach ($users as $user) {
            if (Hash::check($data['refreshToken'], $user->refresh_token_hash)) {
                return response()->json([
                    'accessToken' => JwtService::accessToken(['id' => $user->id, 'email' => $user->email, 'role' => $user->role_name]),
                ]);
            }
        }

        return response()->json(['message' => 'Invalid refresh token'], 401);
    }

    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email']]);
        $token = Str::random(48);
        DB::table('users')->where('email', $data['email'])->update([
            'password_reset_token' => $token,
            'reset_token_expiry' => now()->addMinutes(15),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Password reset token generated. Wire this to email/SMS in production.',
            'resetTokenPreview' => app()->environment('production') ? null : $token,
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'min:20'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $updated = DB::table('users')
            ->where('password_reset_token', $data['token'])
            ->where('reset_token_expiry', '>', now())
            ->update([
                'password_hash' => Hash::make($data['password']),
                'password_reset_token' => null,
                'reset_token_expiry' => null,
                'updated_at' => now(),
            ]);

        return $updated
            ? response()->json(['message' => 'Password reset successful'])
            : response()->json(['message' => 'Invalid or expired reset token'], 400);
    }

    private function issueSession(object $user, array $extra = []): array
    {
        $payload = ['id' => $user->id, 'email' => $user->email, 'role' => $user->role_name];
        $accessToken = JwtService::accessToken($payload);
        $refreshToken = JwtService::refreshToken($payload);

        DB::table('users')->where('id', $user->id)->update([
            'refresh_token_hash' => Hash::make($refreshToken),
            'updated_at' => now(),
        ]);

        return [
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'fullName' => $user->full_name,
                'role' => $user->role_name,
            ],
        ] + $extra;
    }

    private function ensureFacultyRole(): string
    {
        $existing = DB::table('roles')->where('name', 'FACULTY')->first();
        if ($existing) {
            return $existing->id;
        }

        DB::table('roles')->insert([
            'id' => 'role-faculty',
            'name' => 'FACULTY',
            'permissions' => json_encode(['attendance:create', 'attendance:update:own', 'analytics:own', 'leave:review']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return 'role-faculty';
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
