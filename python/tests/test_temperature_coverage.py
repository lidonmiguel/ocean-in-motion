"""Offline checks for the NOAA eligibility threshold and published audit."""
import hashlib
import json
import unittest
from pathlib import Path

import numpy as np

from ocean_pipeline.temperature import regional_record

ROOT = Path(__file__).resolve().parents[2]


class TemperatureCoverageTests(unittest.TestCase):
    def test_two_complete_cells_use_area_weights_and_exclude_partial_cells(self):
        row, cells = regional_record(2025, 'test', np.array([True, True, True]),
                                    np.array([3650., 7300., 100000.]),
                                    np.array([365, 365, 334]), np.array([1., .5, 1.]))
        self.assertEqual(cells, 2)
        self.assertEqual(row['cells'], 2)
        self.assertAlmostEqual(row['celsius'], 13.33)

    def test_one_complete_cell_is_not_enough_even_with_partial_neighbors(self):
        row, cells = regional_record(2025, 'test', np.array([True, True]),
                                    np.array([3650., 7300.]), np.array([365, 334]), np.ones(2))
        self.assertIsNone(row)
        self.assertEqual(cells, 1)

    def test_leap_year_requires_366_days_and_polygon_mask_is_respected(self):
        row, cells = regional_record(2024, 'test', np.array([True, False, True]),
                                    np.array([3660., 7320., 10980.]),
                                    np.array([366, 366, 365]), np.ones(3))
        self.assertIsNone(row)
        self.assertEqual(cells, 1)

    def test_manifest_traces_every_month_and_every_region_year_to_the_snapshot(self):
        manifest = json.loads((ROOT/'data/geography/marine-temperature.manifest.json').read_text())
        snapshot_path = ROOT/'src/data/seaTemperatures.json'
        snapshot = json.loads(snapshot_path.read_text())
        self.assertEqual(manifest['snapshotSha256'], hashlib.sha256(snapshot_path.read_bytes()).hexdigest())
        generator = ROOT/'python/ocean_pipeline/temperature.py'
        self.assertEqual(manifest['codeSha256'], hashlib.sha256(generator.read_bytes()).hexdigest())
        geometry = ROOT/'data/geography/iho-sea-areas-simplified.geojson'
        self.assertEqual(manifest['geometrySha256'], hashlib.sha256(geometry.read_bytes()).hexdigest())
        years = list(range(snapshot['startYear'], snapshot['endYear']+1))
        self.assertEqual([(r['year'], r['month']) for r in manifest['inputs']],
                         [(year, month) for year in years for month in range(1, 13)])
        self.assertTrue(all(len(r['sha256']) == 64 for r in manifest['inputs']))
        rows = {(r['areaId'], r['year']): r for r in snapshot['records']}
        self.assertEqual(len(rows), len(snapshot['records']))
        self.assertEqual(len(manifest['coverage']), 101)
        for area in manifest['coverage']:
            self.assertEqual([r['year'] for r in area['years']], years)
            for coverage in area['years']:
                row = rows[(area['areaId'], coverage['year'])]
                eligible = coverage['completeCells'] >= manifest['minimumCompleteCells']
                self.assertEqual(row.get('method') != 'estimated', eligible)
                self.assertEqual(row['cells'], coverage['completeCells'] if eligible else 0)
                if not eligible:
                    self.assertTrue(row['estimatedFrom'])
