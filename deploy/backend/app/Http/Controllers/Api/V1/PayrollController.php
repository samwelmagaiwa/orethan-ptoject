<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\SalarySlipMail;
use App\Models\ChartOfAccount;
use App\Models\Employee;
use App\Models\JournalEntry;
use App\Models\Payroll;
use App\Models\PayrollItem;
use App\Models\PayrollItemDetail;
use App\Models\SalaryComponent;
use App\Services\AccountingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class PayrollController extends Controller
{
    // ─────────────── SALARY COMPONENTS ───────────────

    public function componentsIndex()
    {
        return response()->json(['data' => SalaryComponent::orderBy('sort_order')->get()]);
    }

    public function componentsStore(Request $request)
    {
        $data = $request->validate([
            'code'           => 'required|string|max:30|unique:salary_components,code',
            'name'           => 'required|string|max:100',
            'type'           => 'required|in:earning,deduction',
            'taxable'        => 'boolean',
            'statutory'      => 'boolean',
            'active'         => 'boolean',
            'default_amount' => 'numeric|min:0',
            'sort_order'     => 'integer|min:0',
        ]);
        return response()->json(['data' => SalaryComponent::create($data)], 201);
    }

    public function componentsUpdate(Request $request, $id)
    {
        $c = SalaryComponent::findOrFail($id);
        $data = $request->validate([
            'code'           => "required|string|max:30|unique:salary_components,code,{$id}",
            'name'           => 'required|string|max:100',
            'type'           => 'required|in:earning,deduction',
            'taxable'        => 'boolean',
            'statutory'      => 'boolean',
            'active'         => 'boolean',
            'default_amount' => 'numeric|min:0',
            'sort_order'     => 'integer|min:0',
        ]);
        $c->update($data);
        return response()->json(['data' => $c]);
    }

    public function componentsDestroy($id)
    {
        $c = SalaryComponent::findOrFail($id);
        if ($c->details()->exists()) {
            return response()->json(['message' => 'Component is used in payroll records and cannot be deleted.'], 422);
        }
        $c->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─────────────── EMPLOYEES ───────────────

    private function generateEmployeeId(?string $hireDate = null): string
    {
        $year   = $hireDate ? \Carbon\Carbon::parse($hireDate)->year : now()->year;
        $prefix = "ORN-ZKM-{$year}-";
        $last   = Employee::where('employee_id', 'like', $prefix . '%')
            ->orderByRaw('CAST(SUBSTRING(employee_id, ' . (strlen($prefix) + 1) . ') AS UNSIGNED) DESC')
            ->value('employee_id');
        $next = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;
        return $prefix . str_pad($next, 3, '0', STR_PAD_LEFT);
    }

    public function nextEmployeeId(Request $request)
    {
        return response()->json(['employee_id' => $this->generateEmployeeId($request->query('hire_date'))]);
    }

    public function employeesIndex()
    {
        return response()->json(['data' => Employee::orderBy('department')->orderBy('full_name')->get()]);
    }

    public function employeesStore(Request $request)
    {
        $data = $request->validate([
            'employee_id'     => 'nullable|string|max:30|unique:employees,employee_id',
            'full_name'       => 'required|string|max:150',
            'department'      => 'nullable|string|max:100',
            'designation'     => 'nullable|string|max:100',
            'branch'          => 'nullable|string|max:100',
            'employment_type' => 'nullable|in:permanent,contract,casual,probation',
            'basic_salary'    => 'required|numeric|min:0',
            'bank_name'       => 'nullable|string|max:100',
            'bank_account'    => 'nullable|string|max:50',
            'tin_number'      => 'nullable|string|max:50',
            'nssf_number'     => 'nullable|string|max:50',
            'nhif_number'     => 'nullable|string|max:50',
            'phone'           => 'nullable|string|max:20',
            'email'           => 'nullable|email|max:150',
            'hire_date'       => 'nullable|date',
            'active'          => 'boolean',
        ]);
        if (empty($data['employee_id'])) {
            $data['employee_id'] = $this->generateEmployeeId($data['hire_date'] ?? null);
        }
        return response()->json(['data' => Employee::create($data)], 201);
    }

    public function employeesUpdate(Request $request, $id)
    {
        $emp  = Employee::findOrFail($id);
        $data = $request->validate([
            'employee_id'     => "required|string|max:20|unique:employees,employee_id,{$id}",
            'full_name'       => 'required|string|max:150',
            'department'      => 'nullable|string|max:100',
            'designation'     => 'nullable|string|max:100',
            'branch'          => 'nullable|string|max:100',
            'employment_type' => 'nullable|in:permanent,contract,casual,probation',
            'basic_salary'    => 'required|numeric|min:0',
            'bank_name'       => 'nullable|string|max:100',
            'bank_account'    => 'nullable|string|max:50',
            'tin_number'      => 'nullable|string|max:50',
            'nssf_number'     => 'nullable|string|max:50',
            'nhif_number'     => 'nullable|string|max:50',
            'phone'           => 'nullable|string|max:20',
            'email'           => 'nullable|email|max:150',
            'hire_date'       => 'nullable|date',
            'active'          => 'boolean',
        ]);
        $emp->update($data);
        return response()->json(['data' => $emp]);
    }

    public function employeesDestroy($id)
    {
        $emp = Employee::findOrFail($id);
        if ($emp->payrollItems()->exists()) {
            return response()->json(['message' => 'Employee has payroll records and cannot be deleted.'], 422);
        }
        $emp->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function syncUsersToEmployees()
    {
        $users   = \App\Models\User::all();
        $created = [];
        $skipped = [];

        foreach ($users as $user) {
            if (Employee::where('user_id', $user->id)->orWhere('email', $user->email)->exists()) {
                $skipped[] = $user->name;
                continue;
            }
            $hireDate = now()->toDateString();
            $emp      = Employee::create([
                'user_id'         => $user->id,
                'employee_id'     => $this->generateEmployeeId($hireDate),
                'full_name'       => $user->name,
                'email'           => $user->email,
                'phone'           => $user->phone ?? null,
                'hire_date'       => $hireDate,
                'employment_type' => 'permanent',
                'basic_salary'    => 0,
                'active'          => true,
            ]);
            $created[] = ['employee_id' => $emp->employee_id, 'name' => $emp->full_name];
        }

        return response()->json([
            'message' => count($created) . ' employee(s) imported, ' . count($skipped) . ' skipped.',
            'created' => $created,
            'skipped' => $skipped,
        ]);
    }

    // ─────────────── EMPLOYEE SELF-SERVICE ───────────────

    public function mySlips(Request $request)
    {
        $user     = $request->user();
        $employee = Employee::where('user_id', $user->id)->first();

        if (!$employee) {
            return response()->json(['data' => [], 'employee' => null]);
        }

        $items = PayrollItem::with(['payroll', 'details.component'])
            ->where('employee_id', $employee->id)
            ->whereHas('payroll', fn($q) => $q->whereIn('status', ['approved', 'posted', 'paid']))
            ->orderByDesc('payroll_id')
            ->get()
            ->map(fn($item) => array_merge($this->itemShape($item), [
                'payroll' => $this->summaryShape($item->payroll),
            ]));

        return response()->json(['data' => $items, 'employee' => $employee]);
    }

    // ─────────────── PAYROLLS ───────────────

    public function index(Request $request)
    {
        $q = Payroll::with(['creator', 'approver'])
            ->when($request->month,  fn($q) => $q->where('month', $request->month))
            ->when($request->year,   fn($q) => $q->where('year', $request->year))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderByDesc('year')->orderByDesc('month')->orderByDesc('id');

        return response()->json(['data' => $q->get()->map(fn($p) => $this->summaryShape($p))]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'month'    => 'required|integer|min:1|max:12',
            'year'     => 'required|integer|min:2020|max:2099',
            'pay_date' => 'required|date',
            'notes'    => 'nullable|string',
        ]);

        if (Payroll::where('month', $data['month'])->where('year', $data['year'])->exists()) {
            return response()->json(['message' => 'A payroll for this month already exists.'], 422);
        }

        $no = 'PAY-' . $data['year'] . '-' . str_pad($data['month'], 2, '0', STR_PAD_LEFT);

        return DB::transaction(function () use ($data, $no, $request) {
            $payroll = Payroll::create([
                'payroll_no' => $no,
                'month'      => $data['month'],
                'year'       => $data['year'],
                'pay_date'   => $data['pay_date'],
                'status'     => 'draft',
                'notes'      => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            $components = SalaryComponent::where('active', true)->orderBy('sort_order')->get();
            $employees  = Employee::where('active', true)->get();

            foreach ($employees as $emp) {
                $basic = $emp->basic_salary;
                $paye  = $this->calculatePAYE($basic);
                $nssf  = round($basic * 0.10);
                $nhif  = $this->calculateNHIF($basic);

                $totalEarnings   = $basic;
                $totalDeductions = 0;

                $item = PayrollItem::create([
                    'payroll_id'       => $payroll->id,
                    'employee_id'      => $emp->id,
                    'gross_salary'     => $basic,
                    'total_earnings'   => $basic,
                    'total_deductions' => 0,
                    'net_salary'       => $basic,
                    'payment_status'   => 'pending',
                    'payment_method'   => $emp->bank_account ? 'bank_transfer' : 'cash',
                ]);

                foreach ($components as $comp) {
                    $amount = match ($comp->code) {
                        'BASIC' => $basic,
                        'PAYE'  => $paye,
                        'NSSF'  => $nssf,
                        'NHIF'  => $nhif,
                        default => $comp->default_amount,
                    };

                    if ($amount > 0 || in_array($comp->code, ['BASIC', 'PAYE', 'NSSF', 'NHIF'])) {
                        PayrollItemDetail::create([
                            'payroll_item_id' => $item->id,
                            'component_id'    => $comp->id,
                            'amount'          => $amount,
                        ]);
                    }

                    if ($comp->type === 'earning')
                        $totalEarnings   += ($comp->code === 'BASIC' ? 0 : $amount);
                    if ($comp->type === 'deduction')
                        $totalDeductions += $amount;
                }

                $item->update([
                    'total_earnings'   => $totalEarnings,
                    'gross_salary'     => $totalEarnings,
                    'total_deductions' => $totalDeductions,
                    'net_salary'       => $totalEarnings - $totalDeductions,
                ]);
            }

            return response()->json(['data' => $this->summaryShape($payroll)], 201);
        });
    }

    public function show($id)
    {
        $payroll = Payroll::with(['creator', 'approver'])->findOrFail($id);
        $items   = PayrollItem::with(['employee', 'details.component'])
            ->where('payroll_id', $id)
            ->get()
            ->map(fn($item) => $this->itemShape($item));

        return response()->json([
            'data' => array_merge($this->summaryShape($payroll), ['items' => $items]),
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        $payroll = Payroll::with(['items.details.component', 'items.employee'])->findOrFail($id);
        $data    = $request->validate([
            'status'               => 'required|in:draft,approved,posted,paid,cancelled',
            'payment_account_code' => 'nullable|string|max:20',
            'payment_method'       => 'nullable|in:bank_transfer,cash,mobile_money',
            'payment_reference'    => 'nullable|string|max:100',
        ]);

        $transitions = [
            'draft'     => ['approved', 'cancelled'],
            'approved'  => ['posted', 'draft', 'cancelled'],
            'posted'    => ['paid', 'cancelled'],
            'paid'      => [],
            'cancelled' => [],
        ];

        $newStatus = $data['status'];

        if (!in_array($newStatus, $transitions[$payroll->status] ?? [])) {
            return response()->json(['message' => "Cannot transition from {$payroll->status} to {$newStatus}."], 422);
        }

        $update = ['status' => $newStatus];

        if ($newStatus === 'approved') {
            $update['approved_by'] = $request->user()->id;
            $update['approved_at'] = now();
        }

        // ── POST TO GL ──────────────────────────────────────────────────────
        if ($newStatus === 'posted') {
            try {
                $glId = $this->postSalaryExpenseToGL($payroll, $request->user());
                if ($glId) $update['gl_post_journal_id'] = $glId;
            } catch (\Throwable $e) {
                Log::error("Payroll GL post failed for #{$payroll->payroll_no}: " . $e->getMessage());
                // GL failure is non-blocking — payroll still moves to posted
            }
        }

        // ── RECORD PAYMENT IN GL + SEND EMAILS ──────────────────────────────
        if ($newStatus === 'paid') {
            $accountCode = $data['payment_account_code'] ?? null;
            $method      = $data['payment_method'] ?? 'bank_transfer';
            $reference   = $data['payment_reference'] ?? null;

            try {
                $glId = $this->postSinglePaymentToGL($payroll, $request->user(), $accountCode ?? ($method === 'cash' ? '1010' : '1020'));
                if ($glId) $update['gl_pay_journal_id'] = $glId;
            } catch (\Throwable $e) {
                Log::error("Payroll GL payment failed for #{$payroll->payroll_no}: " . $e->getMessage());
            }

            // Mark all pending items as paid
            $payroll->items->each(function ($item) use ($method, $reference) {
                if ($item->payment_status === 'pending') {
                    $item->update([
                        'payment_status'    => 'paid',
                        'payment_date'      => now()->toDateString(),
                        'payment_method'    => $item->payment_method ?: $method,
                        'payment_reference' => $item->payment_reference ?: $reference,
                    ]);
                }
            });

            // Send salary slip emails
            $this->sendSalarySlipEmails($payroll);
        }

        $payroll->update($update);

        return response()->json(['data' => $this->summaryShape($payroll->fresh(['creator', 'approver']))]);
    }

    public function updateItem(Request $request, $itemId)
    {
        $item = PayrollItem::with('payroll', 'employee', 'details.component')->findOrFail($itemId);

        if (!in_array($item->payroll->status, ['draft', 'approved'])) {
            return response()->json(['message' => 'Cannot edit items on a posted or paid payroll.'], 422);
        }

        $data = $request->validate([
            'details'                       => 'required|array',
            'details.*.component_id'        => 'required|integer|exists:salary_components,id',
            'details.*.amount'              => 'required|numeric|min:0',
            'payment_method'                => 'nullable|in:bank_transfer,cash,mobile_money',
            'payment_reference'             => 'nullable|string|max:100',
        ]);

        DB::transaction(function () use ($item, $data) {
            foreach ($data['details'] as $d) {
                PayrollItemDetail::updateOrCreate(
                    ['payroll_item_id' => $item->id, 'component_id' => $d['component_id']],
                    ['amount' => $d['amount']]
                );
            }
            $item->load('details.component');
            $earnings   = $item->details->filter(fn($d) => $d->component?->type === 'earning')->sum('amount');
            $deductions = $item->details->filter(fn($d) => $d->component?->type === 'deduction')->sum('amount');

            $item->update([
                'total_earnings'   => $earnings,
                'gross_salary'     => $earnings,
                'total_deductions' => $deductions,
                'net_salary'       => $earnings - $deductions,
                'payment_method'   => $data['payment_method'] ?? $item->payment_method,
                'payment_reference'=> $data['payment_reference'] ?? $item->payment_reference,
            ]);
        });

        $item->load('employee', 'details.component');
        return response()->json(['data' => $this->itemShape($item)]);
    }

    /** Mark an individual employee as paid and send their slip email */
    public function payItem(Request $request, $itemId)
    {
        $item = PayrollItem::with(['payroll', 'employee', 'details.component'])->findOrFail($itemId);

        if ($item->payroll->status !== 'posted') {
            return response()->json(['message' => 'Payroll must be in posted status to mark individual payments.'], 422);
        }
        if ($item->payment_status === 'paid') {
            return response()->json(['message' => 'This employee is already marked as paid.'], 422);
        }

        $data = $request->validate([
            'payment_method'       => 'nullable|in:bank_transfer,cash,mobile_money',
            'payment_reference'    => 'nullable|string|max:100',
            'payment_account_code' => 'nullable|string|max:20',
        ]);

        $method = $data['payment_method'] ?? $item->payment_method;

        $item->update([
            'payment_status'    => 'paid',
            'payment_date'      => now()->toDateString(),
            'payment_method'    => $method,
            'payment_reference' => $data['payment_reference'] ?? $item->payment_reference,
        ]);

        $this->sendSlipEmail($item, $item->payroll);

        $allPaid = PayrollItem::where('payroll_id', $item->payroll_id)
            ->where('payment_status', '!=', 'paid')
            ->doesntExist();

        if ($allPaid) {
            try {
                $payroll = $item->payroll->load(['items.details.component', 'items.employee']);
                $accountCode = $data['payment_account_code'] ?? ($method === 'cash' ? '1010' : '1020');
                $glId = $this->postSinglePaymentToGL($payroll, $request->user(), $accountCode);
                $upd  = ['status' => 'paid'];
                if ($glId) $upd['gl_pay_journal_id'] = $glId;
                $item->payroll->update($upd);
            } catch (\Throwable $e) {
                Log::error("Auto-paid GL post failed: " . $e->getMessage());
                $item->payroll->update(['status' => 'paid']);
            }
        }

        $item->load('employee', 'details.component');
        return response()->json([
            'data'         => $this->itemShape($item),
            'payroll_paid' => $allPaid,
        ]);
    }

    /** Resend the salary slip email for a specific payroll item */
    public function resendSlipEmail(Request $request, $itemId)
    {
        $item = PayrollItem::with(['payroll', 'employee', 'details.component'])->findOrFail($itemId);

        if (!in_array($item->payroll->status, ['posted', 'paid'])) {
            return response()->json(['message' => 'Can only send slips for posted or paid payrolls.'], 422);
        }

        $sent = $this->sendSlipEmail($item, $item->payroll);
        $item->load('employee', 'details.component');

        return response()->json([
            'data'    => $this->itemShape($item),
            'message' => $sent ? 'Email sent successfully.' : 'Employee has no email address on record.',
        ]);
    }

    public function destroy($id)
    {
        $payroll = Payroll::findOrFail($id);
        if ($payroll->status !== 'draft') {
            return response()->json(['message' => 'Only draft payrolls can be deleted.'], 422);
        }
        $payroll->delete();
        return response()->json(['message' => 'Payroll deleted']);
    }

    // ─────────────── PAYMENT ACCOUNTS ───────────────

    /** Return asset/cash accounts available for salary payment, plus the admin-configured defaults */
    public function paymentAccounts()
    {
        $settings = \App\Models\LoanSetting::current();

        $accounts = ChartOfAccount::whereIn('account_type', ['asset'])
            ->where('is_active', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'account_type']);

        return response()->json([
            'accounts' => $accounts,
            'defaults' => [
                'bank_account_code' => $settings->salary_bank_account_code ?? '1020',
                'cash_account_code' => $settings->salary_cash_account_code ?? '1010',
            ],
        ]);
    }

    // ─────────────── ANALYTICS ───────────────

    /** Multi-month payroll summary: last N months (default 12) */
    public function analytics(Request $request)
    {
        $months = min((int) ($request->query('months', 12)), 24);

        $rows = DB::table('payrolls')
            ->join('payroll_items', 'payrolls.id', '=', 'payroll_items.payroll_id')
            ->select(
                'payrolls.id',
                'payrolls.payroll_no',
                'payrolls.month',
                'payrolls.year',
                'payrolls.status',
                'payrolls.pay_date',
                DB::raw('COUNT(payroll_items.id) AS headcount'),
                DB::raw('SUM(payroll_items.gross_salary) AS total_gross'),
                DB::raw('SUM(payroll_items.total_deductions) AS total_deductions'),
                DB::raw('SUM(payroll_items.net_salary) AS total_net'),
                DB::raw("SUM(CASE WHEN payroll_items.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count"),
            )
            ->whereIn('payrolls.status', ['approved', 'posted', 'paid'])
            ->orderByDesc('payrolls.year')
            ->orderByDesc('payrolls.month')
            ->limit($months)
            ->groupBy('payrolls.id', 'payrolls.payroll_no', 'payrolls.month', 'payrolls.year', 'payrolls.status', 'payrolls.pay_date')
            ->get();

        return response()->json(['data' => $rows]);
    }

    /** Department breakdown for a specific payroll */
    public function breakdown($id)
    {
        $payroll = Payroll::findOrFail($id);

        $rows = DB::table('payroll_items')
            ->join('employees', 'payroll_items.employee_id', '=', 'employees.id')
            ->leftJoin('payroll_item_details as pid_paye', function ($j) {
                $j->on('pid_paye.payroll_item_id', '=', 'payroll_items.id')
                  ->whereExists(fn($q) => $q->from('salary_components')
                      ->whereColumn('salary_components.id', 'pid_paye.component_id')
                      ->where('salary_components.code', 'PAYE'));
            })
            ->leftJoin('payroll_item_details as pid_nssf', function ($j) {
                $j->on('pid_nssf.payroll_item_id', '=', 'payroll_items.id')
                  ->whereExists(fn($q) => $q->from('salary_components')
                      ->whereColumn('salary_components.id', 'pid_nssf.component_id')
                      ->where('salary_components.code', 'NSSF'));
            })
            ->leftJoin('payroll_item_details as pid_nhif', function ($j) {
                $j->on('pid_nhif.payroll_item_id', '=', 'payroll_items.id')
                  ->whereExists(fn($q) => $q->from('salary_components')
                      ->whereColumn('salary_components.id', 'pid_nhif.component_id')
                      ->where('salary_components.code', 'NHIF'));
            })
            ->where('payroll_items.payroll_id', $id)
            ->select(
                DB::raw("COALESCE(employees.department, 'Unassigned') AS department"),
                DB::raw('COUNT(payroll_items.id) AS headcount'),
                DB::raw('SUM(payroll_items.gross_salary) AS gross'),
                DB::raw('SUM(payroll_items.total_deductions) AS deductions'),
                DB::raw('SUM(payroll_items.net_salary) AS net'),
                DB::raw('SUM(COALESCE(pid_paye.amount, 0)) AS paye'),
                DB::raw('SUM(COALESCE(pid_nssf.amount, 0)) AS nssf'),
                DB::raw('SUM(COALESCE(pid_nhif.amount, 0)) AS nhif'),
                DB::raw("SUM(CASE WHEN payroll_items.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count"),
                DB::raw("SUM(CASE WHEN payroll_items.email_status = 'sent' THEN 1 ELSE 0 END) AS emailed_count"),
            )
            ->groupBy('department')
            ->orderBy('department')
            ->get();

        // Email summary
        $emailSummary = DB::table('payroll_items')
            ->where('payroll_id', $id)
            ->select(
                DB::raw("COALESCE(email_status, 'pending') AS status"),
                DB::raw('COUNT(*) AS cnt'),
            )
            ->groupBy('email_status')
            ->pluck('cnt', 'status');

        return response()->json([
            'departments'   => $rows,
            'email_summary' => $emailSummary,
            'payroll_no'    => $payroll->payroll_no,
        ]);
    }

    // ─────────────── GL INTEGRATION ───────────────

    /** Post salary expense: Dr 5010 Salaries / Cr 2200 Accrued Payable */
    private function postSalaryExpenseToGL(Payroll $payroll, $user): ?int
    {
        $totalGross = $payroll->items->sum('gross_salary');
        if ($totalGross <= 0) return null;

        $salariesAccount = ChartOfAccount::where('code', '5010')->first();
        $accruedAccount  = ChartOfAccount::where('code', '2200')->first();

        if (!$salariesAccount || !$accruedAccount) {
            Log::warning('Payroll GL: accounts 5010 or 2200 not found.');
            return null;
        }

        $period = date('F', mktime(0, 0, 0, $payroll->month, 1)) . ' ' . $payroll->year;
        $svc    = app(AccountingService::class);

        $entry = $svc->postJournalEntry([
            'description'    => "Salary expense — {$payroll->payroll_no} ({$period})",
            'entry_date'     => $payroll->pay_date ?? now()->toDateString(),
            'reference_type' => 'payroll',
            'reference_id'   => $payroll->id,
            'lines'          => [
                [
                    'chart_of_account_id' => $salariesAccount->id,
                    'debit'               => $totalGross,
                    'credit'              => 0,
                    'description'         => "Salaries & wages — {$payroll->payroll_no}",
                ],
                [
                    'chart_of_account_id' => $accruedAccount->id,
                    'debit'               => 0,
                    'credit'              => $totalGross,
                    'description'         => "Accrued payroll payable — {$payroll->payroll_no}",
                ],
            ],
        ], $user);

        return $entry->id ?? null;
    }

    /**
     * Post salary payment to GL using the operator-selected payment account.
     * Dr 2200 Accrued Salaries Payable / Cr <selected account>
     */
    private function postSinglePaymentToGL(Payroll $payroll, $user, string $paymentAccountCode): ?int
    {
        $totalNet = $payroll->items->sum('net_salary');
        if ($totalNet <= 0) return null;

        $accruedAccount  = ChartOfAccount::where('code', '2200')->first();
        $paymentAccount  = ChartOfAccount::where('code', $paymentAccountCode)->first();

        if (!$accruedAccount || !$paymentAccount) {
            Log::warning("Payroll GL payment: account 2200 or {$paymentAccountCode} not found.");
            return null;
        }

        $period = date('F', mktime(0, 0, 0, $payroll->month, 1)) . ' ' . $payroll->year;
        $svc    = app(AccountingService::class);

        $entry = $svc->postJournalEntry([
            'description'    => "Net salary payment — {$payroll->payroll_no} ({$period})",
            'entry_date'     => now()->toDateString(),
            'reference_type' => 'payroll',
            'reference_id'   => $payroll->id,
            'lines'          => [
                [
                    'chart_of_account_id' => $accruedAccount->id,
                    'debit'               => $totalNet,
                    'credit'              => 0,
                    'description'         => "Clear payroll payable — {$payroll->payroll_no}",
                ],
                [
                    'chart_of_account_id' => $paymentAccount->id,
                    'debit'               => 0,
                    'credit'              => $totalNet,
                    'description'         => "Salary payment via {$paymentAccount->name} — {$payroll->payroll_no}",
                ],
            ],
        ], $user);

        return $entry->id ?? null;
    }

    // ─────────────── EMAIL ───────────────

    private function sendSalarySlipEmails(Payroll $payroll): void
    {
        $payroll->load(['items.details.component', 'items.employee']);
        foreach ($payroll->items as $item) {
            $this->sendSlipEmail($item, $payroll);
        }
    }

    private function sendSlipEmail(PayrollItem $item, Payroll $payroll): bool
    {
        $emp = $item->employee;
        if (!$emp || empty($emp->email)) {
            $item->update(['email_status' => 'no_email']);
            return false;
        }

        $item->load('details.component');
        $earnings   = $item->details->filter(fn($d) => $d->component?->type === 'earning');
        $deductions = $item->details->filter(fn($d) => $d->component?->type === 'deduction');
        $period     = date('F', mktime(0, 0, 0, $payroll->month, 1)) . ' ' . $payroll->year;

        $slipData = [
            'payroll_no'        => $payroll->payroll_no,
            'period'            => $period,
            'pay_date'          => $payroll->pay_date?->format('d M Y') ?? '',
            'status'            => $payroll->status,
            'emp_id'            => $emp->employee_id,
            'emp_name'          => $emp->full_name,
            'department'        => $emp->department,
            'designation'       => $emp->designation,
            'branch'            => $emp->branch,
            'employment_type'   => $emp->employment_type,
            'tin_number'        => $emp->tin_number,
            'nssf_number'       => $emp->nssf_number,
            'nhif_number'       => $emp->nhif_number,
            'bank_name'         => $emp->bank_name,
            'bank_account'      => $emp->bank_account,
            'gross_salary'      => $item->gross_salary,
            'total_deductions'  => $item->total_deductions,
            'net_salary'        => $item->net_salary,
            'net_words'         => $this->numberToWords((int) $item->net_salary),
            'payment_method'    => $item->payment_method,
            'payment_reference' => $item->payment_reference,
            'payment_date'      => $item->payment_date?->format('d M Y'),
            'earnings'          => $earnings->map(fn($d) => [
                'code'   => $d->component->code,
                'name'   => $d->component->name,
                'amount' => $d->amount,
            ])->values()->toArray(),
            'deductions'        => $deductions->map(fn($d) => [
                'code'   => $d->component->code,
                'name'   => $d->component->name,
                'amount' => $d->amount,
            ])->values()->toArray(),
        ];

        try {
            Mail::to($emp->email)->send(new SalarySlipMail($slipData));
            $item->update(['email_sent_at' => now(), 'email_status' => 'sent']);
            return true;
        } catch (\Throwable $e) {
            Log::error("Salary slip email failed for {$emp->full_name} ({$emp->email}): " . $e->getMessage());
            $item->update(['email_status' => 'failed']);
            return false;
        }
    }

    // ─────────────── HELPERS ───────────────

    private function summaryShape(Payroll $p): array
    {
        return [
            'id'                  => $p->id,
            'payroll_no'          => $p->payroll_no,
            'month'               => $p->month,
            'year'                => $p->year,
            'pay_date'            => $p->pay_date?->format('Y-m-d'),
            'status'              => $p->status,
            'notes'               => $p->notes,
            'gl_post_journal_id'  => $p->gl_post_journal_id,
            'gl_pay_journal_id'   => $p->gl_pay_journal_id,
            'created_by'          => $p->creator  ? ['id' => $p->creator->id,  'name' => $p->creator->name]  : null,
            'approved_by'         => $p->approver ? ['id' => $p->approver->id, 'name' => $p->approver->name] : null,
            'approved_at'         => $p->approved_at?->toDateTimeString(),
            'created_at'          => $p->created_at?->toDateTimeString(),
        ];
    }

    private function itemShape(PayrollItem $item): array
    {
        return [
            'id'                => $item->id,
            'employee'          => $item->employee,
            'gross_salary'      => $item->gross_salary,
            'total_earnings'    => $item->total_earnings,
            'total_deductions'  => $item->total_deductions,
            'net_salary'        => $item->net_salary,
            'payment_status'    => $item->payment_status,
            'payment_method'    => $item->payment_method,
            'payment_reference' => $item->payment_reference,
            'payment_date'      => $item->payment_date?->format('Y-m-d'),
            'email_sent_at'     => $item->email_sent_at?->toDateTimeString(),
            'email_status'      => $item->email_status,
            'details'           => $item->details->sortBy('component.sort_order')->map(fn($d) => [
                'id'        => $d->id,
                'component' => $d->component,
                'amount'    => $d->amount,
            ])->values(),
        ];
    }

    /** Tanzania PAYE (monthly) */
    private function calculatePAYE(float $gross): float
    {
        if ($gross <= 270000)  return 0;
        if ($gross <= 520000)  return round(($gross - 270000) * 0.09);
        if ($gross <= 760000)  return round(22500 + ($gross - 520000) * 0.20);
        if ($gross <= 1000000) return round(70500 + ($gross - 760000) * 0.25);
        return round(130500 + ($gross - 1000000) * 0.30);
    }

    /** NHIF tiered bands */
    private function calculateNHIF(float $gross): float
    {
        return match (true) {
            $gross <= 100000  => 1500,
            $gross <= 200000  => 2500,
            $gross <= 300000  => 3500,
            $gross <= 400000  => 5000,
            $gross <= 500000  => 7000,
            $gross <= 700000  => 8000,
            $gross <= 1000000 => 10000,
            default           => 15000,
        };
    }

    /** Convert integer to English words representation for salary slips */
    private function numberToWords(int $n): string
    {
        if ($n === 0) return 'Zero Tanzanian Shillings Only';

        $ones   = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                   'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
                   'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        $tens   = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        $scales = ['', 'Thousand', 'Million', 'Billion'];

        $parts   = [];
        $scale   = 0;
        $chunks  = [];
        while ($n > 0) {
            $chunks[] = $n % 1000;
            $n        = (int) ($n / 1000);
        }

        foreach ($chunks as $i => $chunk) {
            if ($chunk === 0) { $scale++; continue; }
            $words = '';
            if ($chunk >= 100) {
                $words .= $ones[(int)($chunk / 100)] . ' Hundred ';
                $chunk %= 100;
            }
            if ($chunk >= 20) {
                $words .= $tens[(int)($chunk / 10)] . ' ';
                $chunk %= 10;
            }
            if ($chunk > 0) {
                $words .= $ones[$chunk] . ' ';
            }
            $suffix   = $scales[$i] ? (' ' . $scales[$i]) : '';
            $parts[]  = trim($words) . $suffix;
            $scale++;
        }

        $result = implode(', ', array_reverse($parts));
        return $result . ' Tanzanian Shillings Only';
    }
}
