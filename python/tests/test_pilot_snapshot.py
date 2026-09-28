from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ocean_pipeline.publish_pilot import build_pilot

ROOT = Path(__file__).resolve().parents[2]
EXTRACT = ROOT / "data/obis/loggerhead-west-med-2013-2017.jsonl.gz"
MANIFEST = ROOT / "data/obis/loggerhead-west-med-2013-2017.manifest.json"


class PilotSnapshotTests(unittest.TestCase):
    def test_pilot_layer_matches_source_extract_and_manifest(self):
        layer = build_pilot(EXTRACT, MANIFEST)
        self.assertEqual(layer["summary"]["count"], 117)
        self.assertEqual(layer["source"]["license"], "CC BY 4.0")

    def test_modified_obis_extract_cannot_be_published(self):
        with tempfile.TemporaryDirectory() as directory:
            changed = Path(directory) / "changed.jsonl"
            import gzip
            changed.write_bytes(gzip.decompress(EXTRACT.read_bytes()) + b"\n")
            with self.assertRaisesRegex(ValueError, "checksum"):
                build_pilot(changed, MANIFEST)


if __name__ == "__main__":
    unittest.main()
