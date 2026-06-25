<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('office_delegations', function (Blueprint $table) {
            $table->string('delegator_role')->nullable()->after('delegator_title');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');           // mpokeaji
            $table->string('type')->default('info');
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('link')->nullable();              // ukurasa wa kwenda
            $table->json('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::table('office_delegations', fn(Blueprint $t) => $t->dropColumn('delegator_role'));
        Schema::dropIfExists('notifications');
    }
};
