from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ocean_pipeline import curate


class CuratedPipelineTests(unittest.TestCase):
    def test_accepted_record_rights_are_counted_separately_from_dataset_rights(self):
        curated, _ = curate.build_curated(curate.ROOT / "data/obis", curate.ROOT / "src/data/speciesMetadata.json")
        dolphin = curated["bottlenose-dolphin"]
        california = next(scope for scope in dolphin["sourceScopes"] if scope["id"] == "bottlenose-california")
        self.assertEqual(california["dataset"]["license"], "CC BY-NC 4.0")
        self.assertEqual(california["recordMetadata"]["recordLicenseCounts"], {
            "https://creativecommons.org/licenses/by-sa/4.0": 1,
            "https://creativecommons.org/licenses/by/4.0": 6,
            "https://creativecommons.org/publicdomain/zero/1.0": 215,
        })
        ferry = next(scope for scope in dolphin["sourceScopes"] if scope["id"] == "bottlenose-west-med")
        self.assertEqual(ferry["recordMetadata"]["missingRecordLicense"], 84)
        self.assertEqual(ferry["recordMetadata"]["samplingProtocolCounts"], {
            "visual observation from ferries": 84
        })

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
