import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class CaspianSnapshotTests(unittest.TestCase):
    def test_complete_noaa_history_and_input_provenance(self):
        snapshot = json.loads((ROOT / 'src/data/caspianTemperatures.json').read_text())
        manifest = json.loads((ROOT / 'data/geography/caspian-temperature.manifest.json').read_text())
        geometry = ROOT / 'src/data/caspian.geojson'
        self.assertEqual(manifest['geometrySha256'], hashlib.sha256(geometry.read_bytes()).hexdigest())
        self.assertEqual([(item['year'], item['month']) for item in manifest['inputs']],
                         [(year, month) for year in range(1982, 2026) for month in range(1, 13)])
        self.assertTrue(all(len(item['sha256']) == 64 for item in manifest['inputs']))
        self.assertEqual([item['year'] for item in snapshot['records']], list(range(1982, 2026)))
        for item in snapshot['records']:
            self.assertEqual(item['areaId'], 'caspian')
            self.assertGreaterEqual(item['cells'], 2)
            self.assertNotIn('estimatedFrom', item)
            self.assertGreater(item['celsius'], -2)
            self.assertLess(item['celsius'], 32)
