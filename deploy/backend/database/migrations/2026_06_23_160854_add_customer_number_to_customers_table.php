<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('customer_number')->nullable()->unique()->after('id');
        });

        // Backfill existing customers with CUST-{padded id}
        foreach (\App\Models\Customer::whereNull('customer_number')->get() as $customer) {
            $customer->customer_number = 'CUST-' . str_pad((string) $customer->id, 6, '0', STR_PAD_LEFT);
            $customer->save();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropUnique(['customer_number']);
            $table->dropColumn('customer_number');
        });
    }
};
