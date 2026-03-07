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
        // 1. Catalog Tables
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->timestampsTz();
        });

        Schema::create('instruments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('ticker')->index();
            $table->string('full_name')->nullable();
            $table->string('asset_class'); // Forex, Crypto, Indices, etc.
            $table->timestampsTz();
        });

        Schema::create('strategy_tags', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color_hex', 7)->nullable();
            $table->timestampsTz();
        });

        // 2. Connection Tables
        Schema::create('trading_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');
            $table->string('name');
            $table->string('platform'); // MT5, Binance, Bitget
            $table->jsonb('connection_details')->nullable();
            $table->string('currency', 3)->default('USD');
            $table->decimal('balance_initial', 18, 2);
            $table->timestampsTz();
        });

        // 3. Core Operational Table (Agnostic)
        Schema::create('trades', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('account_id')->constrained('trading_accounts')->onDelete('cascade');
            $table->foreignUuid('instrument_id')->constrained('instruments');
            
            $table->string('external_ticket_id'); // Support for MT5 Ticket or Crypto OrderID
            $table->string('strategy_magic_number')->nullable();
            
            $table->string('side'); // BUY, SELL
            $table->decimal('volume', 18, 8); // Agnostic for Lots (Forex) and Amounts (Crypto)
            
            $table->decimal('open_price', 18, 8);
            $table->decimal('close_price', 18, 8);
            $table->decimal('sl_price', 18, 8)->nullable();
            $table->decimal('tp_price', 18, 8)->nullable();
            
            $table->timestampTz('open_time');
            $table->timestampTz('close_time');
            $table->integer('duration_seconds');
            
            $table->string('close_reason')->nullable();
            $table->decimal('commission', 18, 4)->default(0);
            $table->decimal('swap', 18, 4)->default(0);
            $table->decimal('gross_profit', 18, 4);
            $table->decimal('net_profit', 18, 4);
            
            $table->decimal('mae_price', 18, 8)->nullable();
            $table->decimal('mfe_price', 18, 8)->nullable();

            // Constraints & Indexes
            $table->unique(['account_id', 'external_ticket_id']);
            $table->index(['account_id', 'close_time']);
            $table->timestampsTz();
        });

        // 4. Pivot and Cache Tables
        Schema::create('trade_tags_rel', function (Blueprint $table) {
            $table->foreignUuid('trade_id')->constrained('trades')->onDelete('cascade');
            $table->foreignUuid('tag_id')->constrained('strategy_tags')->onDelete('cascade');
            $table->primary(['trade_id', 'tag_id']);
        });

        Schema::create('daily_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('account_id')->constrained('trading_accounts')->onDelete('cascade');
            $table->date('date');
            $table->decimal('balance_end', 18, 2);
            $table->decimal('daily_pl', 18, 2);
            $table->integer('trades_count');

            // Constraints & Indexes
            $table->unique(['account_id', 'date']);
            $table->index(['account_id', 'date']);
            $table->timestampsTz();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function up_deprecated(): void {} // Added to keep full custom structure

    public function down(): void
    {
        Schema::dropIfExists('daily_snapshots');
        Schema::dropIfExists('trade_tags_rel');
        Schema::dropIfExists('trades');
        Schema::dropIfExists('trading_accounts');
        Schema::dropIfExists('strategy_tags');
        Schema::dropIfExists('instruments');
        Schema::dropIfExists('users');
    }
};
