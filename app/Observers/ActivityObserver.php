<?php

namespace App\Observers;

use App\Services\ActivityLogService;
use Illuminate\Database\Eloquent\Model;

class ActivityObserver
{
    public function __construct(private readonly ActivityLogService $logs)
    {
    }

    public function created(Model $model): void
    {
        $this->logs->modelCreated($model);
    }

    public function updated(Model $model): void
    {
        $this->logs->modelUpdated($model);
    }

    public function deleted(Model $model): void
    {
        $this->logs->modelDeleted($model);
    }
}
