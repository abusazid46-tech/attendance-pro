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

        $file = $this->buildReportFile($teacherId, $data);

        return response()->json([
            'message' => 'Report generated',
            'report' => DB::table('generated_reports')->where('id', $id)->first(),
            'fileName' => $file['fileName'],
            'mimeType' => $file['mimeType'],
            'encoding' => 'base64',
            'contentBase64' => base64_encode($file['content']),
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

    private function buildReportFile(string $teacherId, array $data): array
    {
        $filters = $data['filters'] ?? [];
        $subjectId = $filters['subjectId'] ?? null;
        $semesterId = $filters['semesterId'] ?? null;
        $startDate = $filters['startDate'] ?? null;
        $endDate = $filters['endDate'] ?? null;
        $studentIds = collect($filters['studentIds'] ?? [])->filter()->values()->all();
        $subject = $subjectId ? DB::table('subjects')->where('id', $subjectId)->first() : null;
        $semester = $semesterId ? DB::table('semesters')->where('id', $semesterId)->first() : null;
        $teacher = DB::table('teachers')
            ->join('users', 'users.id', '=', 'teachers.user_id')
            ->where('teachers.id', $teacherId)
            ->select('teachers.*', 'users.full_name', 'users.email')
            ->first();
        if ($subjectId && !DB::table('subject_teacher')->where('teacher_id', $teacherId)->where('subject_id', $subjectId)->exists()) {
            abort(response()->json(['message' => 'Selected paper does not belong to this faculty account'], 403));
        }
        $records = $this->reportRows($teacherId, $subjectId, $studentIds, $startDate, $endDate, $semesterId);
        $summaryRows = $this->studentSummaryRows($teacherId, $subjectId, $studentIds, $subject?->semester_id ?? $semesterId, $startDate, $endDate);
        if ($data['type'] === 'DEFAULTER') {
            $summaryRows = $summaryRows->filter(fn ($student) => (int) $student->total > 0 && (int) $student->attendance < 75)->values();
        }
        $diaryRows = $data['type'] === 'TEACHING_DIARY'
            ? $this->diaryRows($teacherId, $subjectId, $semesterId, $startDate, $endDate)
            : collect();
        $meta = [
            'Generated At' => now()->toDateTimeString(),
            'Teacher' => $teacher?->full_name ?? 'Faculty',
            'Semester' => $semester?->name ?? ($filters['semester'] ?? 'All'),
            'Paper' => $subject ? "{$subject->code} - {$subject->name}" : 'All papers',
            'Period' => trim(($startDate ?: 'Beginning').' to '.($endDate ?: 'Today')),
        ];
        $safeTitle = preg_replace('/[^A-Za-z0-9_-]+/', '-', strtolower($data['title']));
        $date = now()->format('Ymd-His');

        if ($data['format'] === 'EXCEL') {
            $csv = $this->csvContent($data['type'], $data['title'], $meta, $summaryRows, $records, $diaryRows);
            return [
                'fileName' => "{$safeTitle}-{$date}.csv",
                'mimeType' => 'text/csv',
                'content' => $csv,
            ];
        }

        return [
            'fileName' => "{$safeTitle}-{$date}.pdf",
            'mimeType' => 'application/pdf',
            'content' => $this->designedPdf($data['type'], $data['title'], $meta, $summaryRows, $records, $diaryRows),
        ];
    }

    private function reportRows(string $teacherId, ?string $subjectId, array $studentIds, ?string $startDate, ?string $endDate, ?string $semesterId)
    {
        return DB::table('attendance')
            ->join('students', 'students.id', '=', 'attendance.student_id')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->join('subjects', 'subjects.id', '=', 'attendance.subject_id')
            ->leftJoin('class_sessions', 'class_sessions.id', '=', 'attendance.class_session_id')
            ->where('attendance.teacher_id', $teacherId)
            ->where('attendance.id', 'not like', 'seed-%')
            ->when($subjectId, fn ($q) => $q->where('attendance.subject_id', $subjectId))
            ->when(!$subjectId && $semesterId, fn ($q) => $q->where('attendance.semester_id', $semesterId))
            ->when($startDate, fn ($q) => $q->whereDate('attendance.date', '>=', $startDate))
            ->when($endDate, fn ($q) => $q->whereDate('attendance.date', '<=', $endDate))
            ->when($studentIds, fn ($q) => $q->whereIn('attendance.student_id', $studentIds))
            ->select(
                'attendance.date',
                'students.id as student_id',
                'students.roll_number',
                'users.full_name',
                'subjects.code as subject_code',
                'subjects.name as subject_name',
                'class_sessions.class_number',
                'class_sessions.topic_taught',
                'attendance.status',
                'attendance.remark'
            )
            ->orderByDesc('attendance.date')
            ->orderByRaw('CAST(students.roll_number AS UNSIGNED), students.roll_number')
            ->get();
    }

    private function studentSummaryRows(string $teacherId, ?string $subjectId, array $studentIds, ?string $semesterId, ?string $startDate, ?string $endDate)
    {
        $attendanceSummary = DB::table('attendance')
            ->where('teacher_id', $teacherId)
            ->where('id', 'not like', 'seed-%')
            ->when($subjectId, fn ($q) => $q->where('subject_id', $subjectId))
            ->when(!$subjectId && $semesterId, fn ($q) => $q->where('semester_id', $semesterId))
            ->when($startDate, fn ($q) => $q->whereDate('date', '>=', $startDate))
            ->when($endDate, fn ($q) => $q->whereDate('date', '<=', $endDate))
            ->select('student_id')
            ->selectRaw("SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present")
            ->selectRaw("SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent")
            ->selectRaw("SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late")
            ->selectRaw("SUM(CASE WHEN status = 'LEAVE' THEN 1 ELSE 0 END) as leave_count")
            ->selectRaw('COUNT(*) as total')
            ->groupBy('student_id');

        return DB::table('students')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->leftJoinSub($attendanceSummary, 'attendance_summary', fn ($join) => $join->on('attendance_summary.student_id', '=', 'students.id'))
            ->where('students.id', 'not like', 'seed-%')
            ->when($subjectId, function ($q) use ($subjectId) {
                $q->whereIn('students.id', function ($sub) use ($subjectId) {
                    $sub->select('student_id')->from('student_subject_enrollments')->where('subject_id', $subjectId);
                });
            })
            ->when(!$subjectId && $semesterId, fn ($q) => $q->where('students.semester_id', $semesterId))
            ->when($studentIds, fn ($q) => $q->whereIn('students.id', $studentIds))
            ->select(
                'students.id',
                'students.roll_number',
                'users.full_name',
                DB::raw('COALESCE(attendance_summary.present, 0) as present'),
                DB::raw('COALESCE(attendance_summary.absent, 0) as absent'),
                DB::raw('COALESCE(attendance_summary.late, 0) as late'),
                DB::raw('COALESCE(attendance_summary.leave_count, 0) as leave_count'),
                DB::raw('COALESCE(attendance_summary.total, 0) as total'),
                DB::raw('CASE WHEN COALESCE(attendance_summary.total, 0) = 0 THEN 0 ELSE ROUND((attendance_summary.present / attendance_summary.total) * 100) END as attendance')
            )
            ->orderByRaw('CAST(students.roll_number AS UNSIGNED), students.roll_number')
            ->get();
    }

    private function diaryRows(string $teacherId, ?string $subjectId, ?string $semesterId, ?string $startDate, ?string $endDate)
    {
        $attendanceCounts = DB::table('attendance')
            ->where('teacher_id', $teacherId)
            ->where('id', 'not like', 'seed-%')
            ->select('class_session_id')
            ->selectRaw("SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_count")
            ->selectRaw("SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count")
            ->groupBy('class_session_id');

        return DB::table('class_sessions')
            ->join('subjects', 'subjects.id', '=', 'class_sessions.subject_id')
            ->leftJoin('semesters', 'semesters.id', '=', 'class_sessions.semester_id')
            ->leftJoin('class_diary_entries', 'class_diary_entries.class_session_id', '=', 'class_sessions.id')
            ->leftJoinSub($attendanceCounts, 'attendance_counts', fn ($join) => $join->on('attendance_counts.class_session_id', '=', 'class_sessions.id'))
            ->where('class_sessions.teacher_id', $teacherId)
            ->where('class_sessions.id', 'not like', 'seed-%')
            ->when($subjectId, fn ($q) => $q->where('class_sessions.subject_id', $subjectId))
            ->when(!$subjectId && $semesterId, fn ($q) => $q->where('class_sessions.semester_id', $semesterId))
            ->when($startDate, fn ($q) => $q->whereDate('class_sessions.date', '>=', $startDate))
            ->when($endDate, fn ($q) => $q->whereDate('class_sessions.date', '<=', $endDate))
            ->select(
                'class_sessions.date',
                'class_sessions.class_number',
                'semesters.name as semester_name',
                'subjects.code as subject_code',
                'subjects.name as subject_name',
                'class_sessions.topic_taught',
                DB::raw('COALESCE(attendance_counts.present_count, 0) as present_count'),
                DB::raw('COALESCE(attendance_counts.absent_count, 0) as absent_count'),
                'class_sessions.duration_minutes',
                'class_diary_entries.assignment_given',
                'class_diary_entries.notes',
                'class_diary_entries.observations'
            )
            ->orderByDesc('class_sessions.date')
            ->orderBy('class_sessions.class_number')
            ->get();
    }

    private function csvContent(string $type, string $title, array $meta, $summaryRows, $records, $diaryRows): string
    {
        $rows = [
            ["Report: {$title}"],
            ...collect($meta)->map(fn ($value, $key) => ["{$key}: {$value}"])->values()->all(),
            [],
        ];

        if ($type === 'TEACHING_DIARY') {
            $rows[] = ['Date', 'Semester', 'Paper', 'Topic Taught', 'Present', 'Absent', 'Note'];
            foreach ($diaryRows as $entry) {
                $rows[] = [$entry->date, $entry->semester_name, "{$entry->subject_code} - {$entry->subject_name}", $entry->topic_taught, $entry->present_count, $entry->absent_count, $this->cleanDiaryNote($entry->notes, $entry->topic_taught)];
            }
        } elseif ($type === 'DAILY') {
            $rows[] = ['Date', 'Class No', 'Roll No', 'Student Name', 'Paper', 'Topic', 'Status', 'Remark'];
            foreach ($records as $record) {
                $rows[] = [$record->date, $record->class_number, $record->roll_number, $record->full_name, "{$record->subject_code} - {$record->subject_name}", $record->topic_taught, $record->status, $record->remark];
            }
        } else {
            [$paperCode, $paperName] = $this->paperParts((string) ($meta['Paper'] ?? ''));
            $rows[] = $type === 'DEFAULTER'
                ? ['Semester', 'Paper Code', 'Paper Name', 'Roll No', 'Student Name', 'Classes Attended', 'Total Classes', 'Attendance %']
                : ['Roll No', 'Student Name', 'Present', 'Absent', 'Late', 'Leave', 'Total', 'Attendance %'];
            foreach ($summaryRows as $student) {
                $rows[] = $type === 'DEFAULTER'
                    ? [$meta['Semester'] ?? '', $paperCode, $paperName, $student->roll_number, $student->full_name, $student->present, $student->total, $student->attendance]
                    : [$student->roll_number, $student->full_name, $student->present, $student->absent, $student->late, $student->leave_count, $student->total, $student->attendance];
            }
            if (in_array($type, ['SUBJECT', 'STUDENT'], true)) {
                $rows[] = [];
                $rows[] = ['Date', 'Class No', 'Roll No', 'Student Name', 'Paper', 'Topic', 'Status', 'Remark'];
                foreach ($records as $record) {
                    $rows[] = [$record->date, $record->class_number, $record->roll_number, $record->full_name, "{$record->subject_code} - {$record->subject_name}", $record->topic_taught, $record->status, $record->remark];
                }
            }
        }

        return collect($rows)->map(fn ($row) => implode(',', array_map(fn ($value) => '"'.str_replace('"', '""', (string) $value).'"', $row)))->implode("\n");
    }

    private function reportLines(string $type, string $title, array $meta, $summaryRows, $records, $diaryRows): array
    {
        $lines = [
            $title,
        ];
        foreach ($meta as $key => $value) {
            $lines[] = "{$key}: {$value}";
        }
        if ($type === 'TEACHING_DIARY') {
            $lines[] = '';
            $lines[] = 'Teaching Diary';
            foreach ($diaryRows->take(60) as $entry) {
                $lines[] = "Date: {$entry->date}";
                $lines[] = "Semester: {$entry->semester_name}";
                $lines[] = "Paper: {$entry->subject_code} - {$entry->subject_name}";
                $lines[] = "Topic Taught: {$entry->topic_taught}";
                $lines[] = "Present: {$entry->present_count}";
                $lines[] = "Absent: {$entry->absent_count}";
                $lines[] = "Note: ".$this->cleanDiaryNote($entry->notes, $entry->topic_taught);
                $lines[] = '';
            }
        } elseif ($type === 'DAILY') {
            $lines[] = '';
            $lines[] = 'Attendance Register';
            foreach ($records->take(80) as $record) {
                $lines[] = "{$record->date} | {$record->roll_number} {$record->full_name} | {$record->subject_code} - {$record->subject_name} | {$record->status} | {$record->topic_taught}";
            }
        } else {
            $lines[] = '';
            $lines[] = $type === 'DEFAULTER' ? 'Defaulter List' : 'Student Summary';
            foreach ($summaryRows as $student) {
                $prefix = $type === 'DEFAULTER' ? "{$meta['Semester']} | {$meta['Paper']} | " : '';
                $lines[] = "{$prefix}{$student->roll_number}. {$student->full_name} - {$student->present}/{$student->total} ({$student->attendance}%)";
            }
            if (in_array($type, ['SUBJECT', 'STUDENT'], true)) {
                $lines[] = '';
                $lines[] = 'Detailed Attendance';
                foreach ($records->take(50) as $record) {
                    $lines[] = "{$record->date} | {$record->roll_number} {$record->full_name} | {$record->subject_code} - {$record->subject_name} | {$record->status}";
                }
            }
        }

        return $lines;
    }

    private function designedPdf(string $type, string $title, array $meta, $summaryRows, $records, $diaryRows): string
    {
        $lines = collect($this->reportLines($type, $title, $meta, $summaryRows, $records, $diaryRows))->take(58)->values();
        $summaryCount = $summaryRows->count();
        $detailCount = $type === 'TEACHING_DIARY' ? $diaryRows->count() : $records->count();
        $streamLines = [
            '0.92 0.99 0.95 rg',
            '0 760 595 82 re f',
            '0 0.38 0.18 rg',
            '0 746 595 8 re f',
            '0.12 0.65 0.32 rg',
            '50 690 145 38 re f',
            '50 642 145 38 re f',
            '220 690 145 38 re f',
            '220 642 145 38 re f',
            '0.95 0.98 0.96 rg',
            '52 692 141 34 re f',
            '52 644 141 34 re f',
            '222 692 141 34 re f',
            '222 644 141 34 re f',
            'BT',
            '/F2 19 Tf',
            '50 804 Td',
            '('.$this->pdfText($title, 70).') Tj',
            '/F1 10 Tf',
            '0 -22 Td',
            '(Institution Attendance Report) Tj',
            'ET',
            'BT',
            '/F2 11 Tf',
            '62 714 Td',
            '(Students: '.$summaryCount.') Tj',
            '170 0 Td',
            '(Rows: '.$detailCount.') Tj',
            '-170 -48 Td',
            '(Format: PDF) Tj',
            '170 0 Td',
            '(Backend: Live) Tj',
            'ET',
            'BT',
            '/F1 10 Tf',
            '50 612 Td',
            '14 TL'
        ];
        foreach ($lines as $index => $line) {
            if ($index === 0) {
                continue;
            }
            $streamLines[] = '('.$this->pdfText($line, 96).') Tj';
            $streamLines[] = 'T*';
        }
        $streamLines[] = 'ET';
        $stream = implode("\n", $streamLines);
        $objects = [
            "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
            "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
            "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
            "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
            "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
            "6 0 obj << /Length ".strlen($stream)." >> stream\n{$stream}\nendstream endobj",
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $object) {
            $offsets[] = strlen($pdf);
            $pdf .= $object."\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= str_pad((string) $offset, 10, '0', STR_PAD_LEFT)." 00000 n \n";
        }
        $pdf .= "trailer << /Size ".(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
        return $pdf;
    }

    private function pdfText(string $value, int $limit): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], substr($value, 0, $limit));
    }

    private function paperParts(string $paper): array
    {
        if (str_contains($paper, ' - ')) {
            return explode(' - ', $paper, 2);
        }
        return [$paper, ''];
    }

    private function cleanDiaryNote(?string $notes, ?string $topic): string
    {
        $value = trim((string) $notes);
        if ($value === '') {
            return 'No notes written yet.';
        }
        if ($topic) {
            $value = preg_replace('/^Topic:\s*'.preg_quote($topic, '/').'\s*/i', '', $value) ?? $value;
        } else {
            $value = preg_replace('/^Topic:.*\R+/i', '', $value) ?? $value;
        }
        return trim($value) ?: 'No notes written yet.';
    }
}
