<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('salary_components', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name');
            $table->enum('type', ['earning', 'deduction']);
            $table->boolean('taxable')->default(false);
            $table->boolean('statutory')->default(false); // auto-calculated (PAYE, NSSF, NHIF)
            $table->boolean('active')->default(true);
            $table->decimal('default_amount', 15, 2)->default(0);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Seed default components
        $now = now();
        DB::table('salary_components')->insert([
            // Earnings
            ['code' => 'BASIC',    'name' => 'Basic Salary',        'type' => 'earning',   'taxable' => true,  'statutory' => false, 'active' => true, 'default_amount' => 0,      'sort_order' => 1,  'created_at' => $now, 'updated_at' => $now],
            ['code' => 'HOUSE',    'name' => 'Housing Allowance',   'type' => 'earning',   'taxable' => true,  'statutory' => false, 'active' => true, 'default_amount' => 0,      'sort_order' => 2,  'created_at' => $now, 'updated_at' => $now],
            ['code' => 'TRANS',    'name' => 'Transport Allowance', 'type' => 'earning',   'taxable' => false, 'statutory' => false, 'active' => true, 'default_amount' => 0,      'sort_order' => 3,  'created_at' => $now, 'updated_at' => $now],
            ['code' => 'MEAL',     'name' => 'Meal Allowance',      'type' => 'earning',   'taxable' => false, 'statutory' => false, 'active' => true, 'default_amount' => 0,      'sort_order' => 4,  'created_at' => $now, 'updated_at' => $now],
            ['code' => 'MEDICAL',  'name' => 'Medical Allowance',   'type' => 'earning',   'taxable' => false, 'statutory' => false, 'active' => true, 'default_amount' => 0,      'sort_order' => 5,  'created_at' => $now, 'updated_at' => $now],
            ['code' => 'OT',       'name' => 'Overtime',            'type' => 'earning',   'taxable' => true,  'statutory' => false, 'active' => true, 'default_amount' => 0,      'sort_order' => 6,  'created_at' => $now, 'updated_at' => $now],
            ['code' => 'BONUS',    'name' => 'Bonus',               'type' => 'earning',   'taxable' => true,  'statutory' => false, 'active' => true, 'default_amount' => 0,      'sort_order' => 7,  'created_at' => $now, 'updated_at' => $now],
            ['code' => 'COMM',     'name' => 'Commission',          'type' => 'earning',   'taxable' => true,  'statutory' => false, 'active' => false,'default_amount' => 0,      'sort_order' => 8,  'created_at' => $now, 'updated_at' => $now],
            // Deductions
            ['code' => 'PAYE',     'name' => 'PAYE Tax',            'type' => 'deduction', 'taxable' => false, 'statutory' => true,  'active' => true, 'default_amount' => 0,      'sort_order' => 10, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'NSSF',     'name' => 'NSSF',                'type' => 'deduction', 'taxable' => false, 'statutory' => true,  'active' => true, 'default_amount' => 0,      'sort_order' => 11, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'NHIF',     'name' => 'NHIF',                'type' => 'deduction', 'taxable' => false, 'statutory' => true,  'active' => true, 'default_amount' => 0,      'sort_order' => 12, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'LOAN_DED', 'name' => 'Loan Deduction',      'type' => 'deduction', 'taxable' => false, 'statutory' => false, 'active' => true, 'default_amount' => 0,      'sort_order' => 13, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'ADV_SAL',  'name' => 'Advance Salary',      'type' => 'deduction', 'taxable' => false, 'statutory' => false, 'active' => true, 'default_amount' => 0,      'sort_order' => 14, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'SACCO',    'name' => 'SACCO',               'type' => 'deduction', 'taxable' => false, 'statutory' => false, 'active' => false,'default_amount' => 0,      'sort_order' => 15, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'UNION',    'name' => 'Union Fee',           'type' => 'deduction', 'taxable' => false, 'statutory' => false, 'active' => false,'default_amount' => 0,      'sort_order' => 16, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_components');
    }
};
