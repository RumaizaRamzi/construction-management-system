<?php

namespace App\Console\Commands;

use App\Services\NotificationAlertService;
use Illuminate\Console\Command;

class GenerateNotificationsCommand extends Command
{
    protected $signature = 'notifications:generate {--window=1 : Days ahead to treat as approaching}';

    protected $description = 'Generate automatic BuildTrack notification alerts from live business data';

    public function handle(NotificationAlertService $alertService): int
    {
        $window = max(0, (int) $this->option('window'));
        $this->info('Generating notifications (window='.$window.' day(s))...');

        $result = $alertService->generate(null, $window);

        $this->info("Created: {$result['created']}");
        $this->info("Skipped (duplicates/no-op): {$result['skipped']}");
        $this->info("Rule errors: {$result['errors']}");

        return self::SUCCESS;
    }
}
