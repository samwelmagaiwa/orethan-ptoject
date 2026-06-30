<?php

namespace App\Console\Commands;

use App\Services\ProvisioningService;
use Illuminate\Console\Command;

/**
 * Month-end loan-loss provisioning. Posts the adjusting entry to bring the
 * Allowance for Loan Losses to the level required by the current portfolio
 * aging. Safe to run repeatedly — posts nothing when already at level.
 */
class RunLoanLossProvisioning extends Command
{
    protected $signature = 'loans:provision';

    protected $description = 'Post the loan-loss provision adjustment to the general ledger';

    public function handle(ProvisioningService $provisioning): int
    {
        $result = $provisioning->run();
        $this->info($result['message'] . ' (required ' . number_format($result['required_provision']) . ', was ' . number_format($result['current_allowance']) . ')');
        return self::SUCCESS;
    }
}
