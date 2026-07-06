<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('attendance:about', function () {
    $this->info('Attendance Pro Laravel API is ready.');
});
