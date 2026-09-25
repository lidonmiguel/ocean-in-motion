import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ocean_pipeline.sources import SourcePlan, stage_bio_oracle_environment, stage_obis_occurrences


class SourcePlanTests(unittest.TestCase):
    def test_rejects_unresolved_taxon_and_unsupported_scenario(self):
        with self.assertRaises(ValueError):
            SourcePlan(" ")
        with self.assertRaises(ValueError):
            SourcePlan("123", scenario="SSP5-8.5")

    def test_integration_points_do_not_silently_fetch_data(self):
        plan = SourcePlan("123")
        with self.assertRaises(NotImplementedError):
            stage_obis_occurrences(plan, Path("unused"))
        with self.assertRaises(NotImplementedError):
            stage_bio_oracle_environment(plan, Path("unused"))


if __name__ == "__main__":
    unittest.main()
