<?php

namespace Database\Seeders;

use App\Models\State;
use App\Models\Lga;
use App\Models\Ward;
use App\Models\Village;
use Illuminate\Database\Seeder;

class TanzaniaLocationsFromCsvSeeder extends Seeder
{
    /**
     * Seed Tanzania regions, districts, wards and villages from CSV files
     * located in the "location-files" directory at the project root.
     *
     * This seeder is idempotent and can be safely re-run; it uses
     * firstOrCreate so it will not create duplicates even when
     * migrate:fresh --seed is executed multiple times.
     */
    public function run()
    {
        $directory = base_path('location-files');

        if (! is_dir($directory)) {
            return;
        }

        foreach (glob($directory . DIRECTORY_SEPARATOR . '*.csv') as $path) {
            $this->importFile($path);
        }
    }

    /**
     * Import a single CSV file.
     */
    protected function importFile(string $path): void
    {
        if (! is_readable($path)) {
            return;
        }

        if (($handle = fopen($path, 'r')) === false) {
            return;
        }

        // Skip header row
        fgetcsv($handle);

        while (($row = fgetcsv($handle)) !== false) {
            // region,regioncode,district,districtcode,ward,wardcode,street,places
            $row = array_pad($row, 8, null);
            [$region, $regionCode, $district, $districtCode, $ward, $wardCode, $street, $places] = $row;

            $regionName   = $this->normalizeName($region);
            $districtName = $this->normalizeName($district);
            $wardName     = $this->normalizeName($ward);
            $streetName   = $this->normalizeName($street);
            $placeName    = $this->normalizeName($places);

            // We need at least region + district + ward to build the hierarchy
            if (! $regionName || ! $districtName || ! $wardName) {
                continue;
            }

            // State/Region
            $state = State::firstOrCreate([
                'name'         => $regionName,
                'country_code' => 'TZ',
            ]);

            // District (LGA model is mapped to the "districts" table)
            $districtModel = Lga::firstOrCreate([
                'name'     => $districtName,
                'state_id' => $state->id,
            ]);

            // Ward
            $wardModel = Ward::firstOrCreate([
                'name'   => $wardName,
                'lga_id' => $districtModel->id,
            ]);

            // Village / Street (optional)
            $villageModel = null;
            if ($streetName) {
                $villageModel = Village::firstOrCreate([
                    'name'    => $streetName,
                    'ward_id' => $wardModel->id,
                ]);
            }

            // Place (optional, tied to village)
            if ($placeName && $villageModel) {
                \App\Models\Place::firstOrCreate([
                    'village_id' => $villageModel->id,
                    'name'       => $placeName,
                ]);
            }
        }

        fclose($handle);
    }

    /**
     * Normalize names from CSV into a consistent format.
     */
    protected function normalizeName(?string $value): ?string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        // Use mbstring to safely normalize mixed-case UTF-8 names
        if (function_exists('mb_strtolower')) {
            $value = mb_strtolower($value, 'UTF-8');
        } else {
            $value = strtolower($value);
        }

        return ucwords($value);
    }
}
