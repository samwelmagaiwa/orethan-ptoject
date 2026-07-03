<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->string('company_name', 150)->default('Microfinance Management System')->after('nssf_payable_account_code');
            $table->string('company_tagline', 200)->nullable()->after('company_name');
            $table->text('company_address')->nullable()->after('company_tagline');
            $table->string('company_phone', 50)->nullable()->after('company_address');
            $table->string('company_email', 100)->nullable()->after('company_phone');
            $table->string('company_website', 150)->nullable()->after('company_email');
            $table->string('company_logo', 300)->nullable()->after('company_website');
            $table->string('company_registration_no', 80)->nullable()->after('company_logo');
            $table->string('company_tin', 50)->nullable()->after('company_registration_no');
            $table->string('currency_code', 10)->default('TZS')->after('company_tin');
            $table->string('date_format', 20)->default('d/m/Y')->after('currency_code');
            $table->string('timezone', 60)->default('Africa/Dar_es_Salaam')->after('date_format');
            $table->tinyInteger('fiscal_year_start_month')->default(1)->after('timezone');
            $table->string('brand_color', 20)->default('#1e5fae')->after('fiscal_year_start_month');
        });
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->dropColumn([
                'company_name', 'company_tagline', 'company_address',
                'company_phone', 'company_email', 'company_website',
                'company_logo', 'company_registration_no', 'company_tin',
                'currency_code', 'date_format', 'timezone',
                'fiscal_year_start_month', 'brand_color',
            ]);
        });
    }
};
