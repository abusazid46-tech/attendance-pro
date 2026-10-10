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
            $excel = $this->excelContent($data['type'], $data['title'], $meta, $summaryRows, $records, $diaryRows);
            return [
                'fileName' => "{$safeTitle}-{$date}.xls",
                'mimeType' => 'application/vnd.ms-excel',
                'content' => $excel,
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

    private function excelContent(string $type, string $title, array $meta, $summaryRows, $records, $diaryRows): string
    {
        [$paperCode, $paperName] = $this->paperParts((string) ($meta['Paper'] ?? ''));
        $semester = (string) ($meta['Semester'] ?? '');
        $sections = [];

        if ($type === 'TEACHING_DIARY') {
            $rows = [['Date', 'Semester', 'Paper No.', 'Paper Name', 'Topic Taught', 'Present', 'Absent', 'Note']];
            foreach ($diaryRows as $entry) {
                $rows[] = [
                    $entry->date,
                    $entry->semester_name,
                    $entry->subject_code,
                    $entry->subject_name,
                    $entry->topic_taught,
                    $entry->present_count,
                    $entry->absent_count,
                    $this->cleanDiaryNote($entry->notes, $entry->topic_taught),
                ];
            }
            $sections[] = ['Teaching Diary', $rows];
        } elseif ($type === 'DAILY') {
            $rows = [['Date', 'Class No.', 'Semester', 'Paper No.', 'Paper Name', 'Roll No.', 'Student Name', 'Topic Taught', 'Status', 'Remark']];
            foreach ($records as $record) {
                $rows[] = [
                    $record->date,
                    $record->class_number,
                    $semester,
                    $record->subject_code,
                    $record->subject_name,
                    $record->roll_number,
                    $record->full_name,
                    $record->topic_taught,
                    $record->status,
                    $record->remark,
                ];
            }
            $sections[] = ['Daily Attendance Register', $rows];
        } else {
            $heading = $type === 'DEFAULTER' ? 'Defaulter List' : 'Student Attendance Summary';
            $rows = $type === 'DEFAULTER'
                ? [['Semester', 'Paper No.', 'Paper Name', 'Roll No.', 'Student Name', 'Classes Attended', 'Total Classes', 'Attendance %']]
                : [['Semester', 'Paper No.', 'Paper Name', 'Roll No.', 'Student Name', 'Present', 'Absent', 'Late', 'Leave', 'Total', 'Attendance %']];
            foreach ($summaryRows as $student) {
                $rows[] = $type === 'DEFAULTER'
                    ? [$semester, $paperCode, $paperName, $student->roll_number, $student->full_name, $student->present, $student->total, $student->attendance]
                    : [$semester, $paperCode, $paperName, $student->roll_number, $student->full_name, $student->present, $student->absent, $student->late, $student->leave_count, $student->total, $student->attendance];
            }
            $sections[] = [$heading, $rows];

            if (in_array($type, ['SUBJECT', 'STUDENT'], true)) {
                $detailRows = [['Date', 'Class No.', 'Semester', 'Paper No.', 'Paper Name', 'Roll No.', 'Student Name', 'Topic Taught', 'Status', 'Remark']];
                foreach ($records as $record) {
                    $detailRows[] = [
                        $record->date,
                        $record->class_number,
                        $semester,
                        $record->subject_code,
                        $record->subject_name,
                        $record->roll_number,
                        $record->full_name,
                        $record->topic_taught,
                        $record->status,
                        $record->remark,
                    ];
                }
                $sections[] = ['Detailed Attendance Register', $detailRows];
            }
        }

        $html = [
            '<html><head><meta charset="UTF-8"><style>',
            'body{font-family:Arial,sans-serif;color:#0f172a;}',
            'h1{font-size:22px;margin:0 0 10px;}h2{font-size:16px;margin:22px 0 8px;}',
            'table{border-collapse:collapse;width:100%;margin-bottom:16px;}',
            'th{background:#16a34a;color:#fff;font-weight:700;}',
            'td,th{border:1px solid #94a3b8;padding:7px;mso-number-format:"@";vertical-align:top;}',
            '.meta td{border:none;padding:3px 7px 3px 0;}',
            '.label{font-weight:700;color:#334155;width:130px;}',
            '</style></head><body>',
            '<h1>'.$this->htmlCell($title).'</h1>',
            '<table class="meta">',
        ];
        foreach ($meta as $key => $value) {
            $html[] = '<tr><td class="label">'.$this->htmlCell((string) $key).'</td><td>'.$this->htmlCell((string) $value).'</td></tr>';
        }
        $html[] = '</table>';

        foreach ($sections as [$sectionTitle, $rows]) {
            $html[] = '<h2>'.$this->htmlCell($sectionTitle).'</h2><table>';
            foreach ($rows as $rowIndex => $row) {
                $tag = $rowIndex === 0 ? 'th' : 'td';
                $html[] = '<tr>'.collect($row)->map(fn ($value) => "<{$tag}>".$this->htmlCell((string) $value)."</{$tag}>")->implode('').'</tr>';
            }
            $html[] = '</table>';
        }

        $html[] = '</body></html>';
        return implode("\n", $html);
    }

    private function reportLines(string $type, string $title, array $meta, $summaryRows, $records, $diaryRows): array
    {
        $lines = [];
        if ($type === 'TEACHING_DIARY') {
            $lines[] = ['HEADER', $this->fixedTableLine(['Date', 'Class', 'Paper', 'Topic Taught', 'Present', 'Absent'], [12, 7, 12, 34, 9, 8])];
            foreach ($diaryRows as $entry) {
                $lines[] = ['ROW', $this->fixedTableLine([
                    $entry->date,
                    $entry->class_number,
                    $entry->subject_code,
                    $entry->topic_taught,
                    $entry->present_count,
                    $entry->absent_count
                ], [12, 7, 12, 34, 9, 8])];
            }
        } elseif ($type === 'DAILY') {
            $lines[] = ['HEADER', $this->fixedTableLine(['Date', 'Class', 'Roll', 'Student Name', 'Paper', 'Status', 'Remark'], [12, 7, 7, 24, 12, 10, 14])];
            foreach ($records as $record) {
                $lines[] = ['ROW', $this->fixedTableLine([
                    $record->date,
                    $record->class_number,
                    $record->roll_number,
                    $record->full_name,
                    $record->subject_code,
                    $record->status,
                    $record->remark ?: '-'
                ], [12, 7, 7, 24, 12, 10, 14])];
            }
        } elseif ($type === 'DEFAULTER') {
            $lines[] = ['HEADER', $this->fixedTableLine(['Roll', 'Student Name', 'Classes Attended', 'Total Classes', 'Attendance %'], [7, 30, 18, 14, 14])];
            foreach ($summaryRows as $student) {
                $lines[] = ['ROW_DEFAULTER', $this->fixedTableLine([
                    $student->roll_number,
                    $student->full_name,
                    $student->present,
                    $student->total,
                    "{$student->attendance}%"
                ], [7, 30, 18, 14, 14])];
            }
        } else {
            // STUDENT / SUBJECT / MONTHLY SUMMARY
            $lines[] = ['HEADER', $this->fixedTableLine(['Roll', 'Student Name', 'Present', 'Absent', 'Late', 'Leave', 'Total', 'Attendance %'], [7, 25, 9, 8, 6, 7, 7, 14])];
            foreach ($summaryRows as $student) {
                $isDef = (int) $student->total > 0 && (int) $student->attendance < 75;
                $lines[] = [$isDef ? 'ROW_DEFAULTER' : 'ROW', $this->fixedTableLine([
                    $student->roll_number,
                    $student->full_name,
                    $student->present,
                    $student->absent,
                    $student->late,
                    $student->leave_count,
                    $student->total,
                    "{$student->attendance}%"
                ], [7, 25, 9, 8, 6, 7, 7, 14])];
            }
        }

        return $lines;
    }

    private function designedPdf(string $type, string $title, array $meta, $summaryRows, $records, $diaryRows): string
    {
        $allLines = $this->reportLines($type, $title, $meta, $summaryRows, $records, $diaryRows);
        $summaryCount = count($summaryRows);
        $detailCount = $type === 'TEACHING_DIARY' ? count($diaryRows) : count($records);
        $defaulterCount = collect($summaryRows)->filter(fn ($s) => (int) ($s->total ?? 0) > 0 && (int) ($s->attendance ?? 0) < 75)->count();
        $avgPct = count($summaryRows) > 0 ? (int) round(collect($summaryRows)->avg('attendance') ?? 0) : 0;

        $headerRow = $allLines[0] ?? ['HEADER', ''];
        $dataRows = array_slice($allLines, 1);

        $pageSize = 26;
        $chunks = count($dataRows) > 0 ? array_chunk($dataRows, $pageSize) : [[]];
        $totalPages = count($chunks);
        $pagesStreams = [];

        foreach ($chunks as $pageIndex => $pageRows) {
            $isFirstPage = ($pageIndex === 0);
            $streamLines = [];

            // Top Header Banner (Emerald Green)
            $streamLines[] = '0.086 0.639 0.290 rg';
            $streamLines[] = '0 762 595 80 re f';
            $streamLines[] = '0.05 0.40 0.18 rg';
            $streamLines[] = '0 758 595 4 re f';

            // Header Typography (White text)
            $streamLines[] = 'BT';
            $streamLines[] = '/F2 15 Tf';
            $streamLines[] = '1 1 1 rg';
            $streamLines[] = '40 806 Td';
            $streamLines[] = '('.$this->pdfText($title, 70).') Tj';
            $streamLines[] = '/F1 9 Tf';
            $streamLines[] = '0.88 0.98 0.91 rg';
            $streamLines[] = '0 -16 Td';
            $streamLines[] = '(ATTENDANCE PRO - ACADEMIC ATTENDANCE REGISTER) Tj';
            $streamLines[] = '/F1 8 Tf';
            $streamLines[] = '1 1 1 rg';
            $streamLines[] = '0 -14 Td';
            $subMeta = "Faculty: ".($meta['Teacher'] ?? 'Faculty')." | Semester: ".($meta['Semester'] ?? 'All')." | Paper: ".($meta['Paper'] ?? 'All')." | Period: ".($meta['Period'] ?? 'All');
            $streamLines[] = '('.$this->pdfText($subMeta, 90).') Tj';
            $streamLines[] = 'ET';

            $startY = 740;

            if ($isFirstPage) {
                // 4 Metric Badges
                $streamLines[] = '0.94 0.98 0.95 rg';
                $streamLines[] = '40 692 120 44 re f';
                $streamLines[] = '172 692 120 44 re f';
                $streamLines[] = '304 692 120 44 re f';
                $streamLines[] = '436 692 119 44 re f';

                $streamLines[] = '0.75 0.88 0.80 RG';
                $streamLines[] = '1 w';
                $streamLines[] = '40 692 120 44 re S';
                $streamLines[] = '172 692 120 44 re S';
                $streamLines[] = '304 692 120 44 re S';
                $streamLines[] = '436 692 119 44 re S';

                $streamLines[] = 'BT';
                $streamLines[] = '/F2 8 Tf';
                $streamLines[] = '0.30 0.42 0.35 rg';
                $streamLines[] = '50 722 Td';
                $streamLines[] = '(STUDENTS) Tj';
                $streamLines[] = '132 0 Td';
                $streamLines[] = '(TOTAL RECORDS) Tj';
                $streamLines[] = '132 0 Td';
                $streamLines[] = '(AVG ATTENDANCE) Tj';
                $streamLines[] = '132 0 Td';
                $streamLines[] = '(DEFAULTERS (<75%)) Tj';
                $streamLines[] = 'ET';

                $streamLines[] = 'BT';
                $streamLines[] = '/F2 14 Tf';
                $streamLines[] = '0.086 0.639 0.290 rg';
                $streamLines[] = '50 702 Td';
                $streamLines[] = '('.$summaryCount.') Tj';
                $streamLines[] = '132 0 Td';
                $streamLines[] = '('.$detailCount.') Tj';
                $streamLines[] = '132 0 Td';
                $streamLines[] = '('.$avgPct.'%) Tj';
                $streamLines[] = $defaulterCount > 0 ? '0.85 0.15 0.15 rg' : '0.086 0.639 0.290 rg';
                $streamLines[] = '132 0 Td';
                $streamLines[] = '('.$defaulterCount.') Tj';
                $streamLines[] = 'ET';

                $startY = 652;
            } else {
                $startY = 730;
            }

            // Table Header Bar (Dark slate)
            $streamLines[] = '0.15 0.23 0.32 rg';
            $streamLines[] = "40 {$startY} 515 22 re f";
            $streamLines[] = 'BT';
            $streamLines[] = '/F4 8 Tf';
            $streamLines[] = '1 1 1 rg';
            $streamLines[] = '46 '.($startY + 7).' Td';
            $streamLines[] = '('.$this->pdfText($headerRow[1] ?? '', 100).') Tj';
            $streamLines[] = 'ET';

            // Table Data Rows
            $y = $startY - 20;
            foreach ($pageRows as $rowIdx => [$rowType, $rowText]) {
                // Zebra row fill
                if ($rowIdx % 2 === 0) {
                    $streamLines[] = '0.97 0.98 0.99 rg';
                    $streamLines[] = "40 ".($y - 3)." 515 18 re f";
                }
                // Divider line
                $streamLines[] = '0.88 0.91 0.94 RG';
                $streamLines[] = '0.5 w';
                $streamLines[] = "40 ".($y - 3)." m 555 ".($y - 3)." l S";

                $textColor = ($rowType === 'ROW_DEFAULTER') ? '0.85 0.15 0.15 rg' : '0.06 0.09 0.16 rg';

                $streamLines[] = 'BT';
                $streamLines[] = '/F3 8 Tf';
                $streamLines[] = $textColor;
                $streamLines[] = '46 '.($y + 2).' Td';
                $streamLines[] = '('.$this->pdfText($rowText, 100).') Tj';
                $streamLines[] = 'ET';

                $y -= 19;
            }

            // Footer
            $streamLines[] = 'BT';
            $streamLines[] = '/F1 8 Tf';
            $streamLines[] = '0.55 0.60 0.65 rg';
            $streamLines[] = '40 30 Td';
            $footerText = "Generated via Attendance Pro Smart Assistant • Page ".($pageIndex + 1)." of {$totalPages} • ".now()->toDateTimeString();
            $streamLines[] = '('.$this->pdfText($footerText, 95).') Tj';
            $streamLines[] = 'ET';

            $pagesStreams[] = implode("\n", $streamLines);
        }

        // Construct PDF 1.4 Object Graph
        $numPages = count($pagesStreams);
        $pageStartIndex = 3;
        $fontStartIndex = $pageStartIndex + $numPages;
        $streamStartIndex = $fontStartIndex + 4;

        $kids = [];
        for ($i = 0; $i < $numPages; $i++) {
            $kids[] = ($pageStartIndex + $i)." 0 R";
        }
        $kidsStr = implode(' ', $kids);

        $objects = [
            "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
            "2 0 obj << /Type /Pages /Kids [{$kidsStr}] /Count {$numPages} >> endobj",
        ];

        for ($i = 0; $i < $numPages; $i++) {
            $pObj = $pageStartIndex + $i;
            $sObj = $streamStartIndex + $i;
            $f1 = $fontStartIndex;
            $f2 = $fontStartIndex + 1;
            $f3 = $fontStartIndex + 2;
            $f4 = $fontStartIndex + 3;
            $objects[] = "{$pObj} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {$f1} 0 R /F2 {$f2} 0 R /F3 {$f3} 0 R /F4 {$f4} 0 R >> >> /Contents {$sObj} 0 R >> endobj";
        }

        $objects[] = "{$fontStartIndex} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj";
        $objects[] = ($fontStartIndex + 1)." 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj";
        $objects[] = ($fontStartIndex + 2)." 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj";
        $objects[] = ($fontStartIndex + 3)." 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >> endobj";

        for ($i = 0; $i < $numPages; $i++) {
            $sObj = $streamStartIndex + $i;
            $content = $pagesStreams[$i];
            $len = strlen($content);
            $objects[] = "{$sObj} 0 obj << /Length {$len} >> stream\n{$content}\nendstream endobj";
        }

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
        $clean = preg_replace('/[^\x20-\x7E]/', '?', substr($value, 0, $limit));
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], (string) $clean);
    }

    private function fixedTableLine(array $values, array $widths): string
    {
        return collect($values)->map(function ($value, $index) use ($widths) {
            $width = $widths[$index] ?? 12;
            $clean = trim(preg_replace('/\s+/', ' ', (string) $value));
            if (strlen($clean) > $width) {
                $clean = substr($clean, 0, max(1, $width - 2)).'..';
            }
            return str_pad($clean, $width);
        })->implode(' ');
    }


    private function htmlCell(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
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
