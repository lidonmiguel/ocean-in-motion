from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ocean_pipeline import curate


class CuratedPipelineTests(unittest.TestCase):
    def test_unreviewed_basis_cannot_enter_clean_file(self):
        original = curate._raw_lines

        def changed_basis(path):
            rows = original(path)
            if path.name.startswith("loggerhead-west-med-2013-2017"):
                rows[0]["basisOfRecord"] = "MachineObservation"
            return rows

        with patch.object(curate, "_raw_lines", side_effect=changed_basis):
            with self.assertRaisesRegex(ValueError, "unreviewed basis of record"):
                curate.build_curated(curate.ROOT / "data/obis", curate.ROOT / "src/data/speciesMetadata.json")


if __name__ == "__main__":
    unittest.main()
