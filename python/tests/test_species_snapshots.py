import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ocean_pipeline.publish_species import STUDIES, build_snapshot

ROOT = Path(__file__).resolve().parents[2]


class SpeciesSnapshotTests(unittest.TestCase):
    def test_published_species_match_complete_checked_extracts(self):
        for slug, study in STUDIES.items():
            with self.subTest(slug=slug):
                raw = ROOT / f"data/obis/{slug}.jsonl.gz"
                manifest = ROOT / f"data/obis/{slug}.manifest.json"
                published = ROOT / f"src/data/observations/{slug}.json"
                expected = build_snapshot(slug, raw, manifest)
                self.assertEqual(expected, json.loads(published.read_text(encoding="utf-8")))
                self.assertGreater(expected["summary"]["count"], 0)
                self.assertEqual(expected["source"]["datasetId"], study["dataset"])


if __name__ == "__main__":
    unittest.main()
