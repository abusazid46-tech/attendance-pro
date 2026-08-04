<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('subjects')) {
            return;
        }

        $indexExists = DB::table('information_schema.statistics')
            ->whereRaw('table_schema = DATABASE()')
            ->where('table_name', 'subjects')
            ->where('index_name', 'subjects_code_unique')
            ->exists();

        if ($indexExists) {
            DB::statement('ALTER TABLE subjects DROP INDEX subjects_code_unique');
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('subjects')) {
            return;
        }

        $indexExists = DB::table('information_schema.statistics')
            ->whereRaw('table_schema = DATABASE()')
            ->where('table_name', 'subjects')
            ->where('index_name', 'subjects_code_unique')
            ->exists();

        if (!$indexExists) {
            DB::statement('ALTER TABLE subjects ADD UNIQUE subjects_code_unique (code)');
        }
    }
};
