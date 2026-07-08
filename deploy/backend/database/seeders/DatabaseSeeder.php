<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'samwelmagaiwa@gmail.com'],
            [
                'name'     => 'Samwel Magaiwa',
                'email'    => 'samwelmagaiwa@gmail.com',
                'password' => \Illuminate\Support\Facades\Hash::make('Samwel123@'),
                'role'     => 'admin',
            ]
        );

        $this->call(ChartOfAccountsSeeder::class);
    }
}
