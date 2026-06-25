<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('office_delegations', function (Blueprint $table) {
            $table->id();

            // Anayekaimisha (MD)
            $table->unsignedBigInteger('delegator_id');
            $table->string('delegator_name');
            $table->string('delegator_title')->default('Managing Director');

            // Anayekaimishwa (mfanyakazi aliyechaguliwa)
            $table->unsignedBigInteger('delegate_id');
            $table->string('delegate_name');
            $table->string('acting_title')->default('Acting Managing Director');

            // Maelezo ya ukaimishaji
            $table->text('reason')->nullable();           // sababu ya kutokuwepo
            $table->date('from_date');
            $table->date('to_date');
            $table->text('responsibilities');             // madaraka/majukumu yanayokaimishwa
            $table->text('limitations')->nullable();      // mipaka (mfano kikomo cha fedha)
            $table->text('handover_notes')->nullable();   // maelezo ya makabidhiano

            // pending | acknowledged | declined
            $table->string('status')->default('pending');
            $table->text('decline_reason')->nullable();

            // Sahihi
            $table->longText('delegator_signature_img')->nullable();
            $table->longText('delegate_signature_img')->nullable();
            $table->date('delegator_date')->nullable();
            $table->timestamp('delegate_date')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['delegate_id', 'status']);
            $table->index(['delegator_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('office_delegations');
    }
};
