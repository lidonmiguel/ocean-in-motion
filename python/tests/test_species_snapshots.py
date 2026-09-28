import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ocean_pipeline.curate import outputs
from ocean_pipeline.publish_species import STUDIES, build_snapshot

ROOT = Path(__file__).resolve().parents[2]


class SpeciesSnapshotTests(unittest.TestCase):
    def test_clean_species_files_match_complete_checked_extracts(self):
        curated = {path.stem: json.loads(path.read_text(encoding="utf-8"))
                   for path in (ROOT / "src/data/curated").glob("*.json")}
        self.assertEqual(len(curated), 7)
        self.assertEqual(sum(data["quality"]["accepted"] for data in curated.values()), 6404)
        for slug, study in STUDIES.items():
            with self.subTest(slug=slug):
                raw = ROOT / f"data/obis/{slug}.jsonl.gz"
                manifest = ROOT / f"data/obis/{slug}.manifest.json"
                expected = build_snapshot(slug, raw, manifest)
                data = next(data for data in curated.values() if data["species"]["scientificName"] == study["species"])
                source = next(source for source in data["sourceScopes"] if source["id"] == slug)
                observations = [row for row in data["observations"] if row["scopeId"] == slug]
                self.assertEqual([row["obisId"] for row in observations], [row["id"] for row in expected["observations"]])
                self.assertEqual(source["dataset"]["extractSha256"], expected["source"]["extractSha256"])
                self.assertEqual(source["quality"]["rejectedByReason"], expected["summary"]["excluded"])
                self.assertGreater(expected["summary"]["count"], 0)
                self.assertEqual(source["dataset"]["datasetId"], study["dataset"])

    def test_curated_files_and_rejection_ledger_are_reproducible(self):
        for path, contents in outputs().items():
            with self.subTest(path=str(path)):
                self.assertEqual((ROOT / path).read_bytes(), contents)


if __name__ == "__main__":
    unittest.main()
