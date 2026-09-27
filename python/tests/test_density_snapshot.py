"""Guard the reviewed model source and public display artifact."""

import gzip
import hashlib
import json
from pathlib import Path
import struct
import unittest

from ocean_pipeline.render_density import SOURCE_SHA256


ROOT = Path(__file__).resolve().parents[2]


class DensitySnapshotTests(unittest.TestCase):
    def test_source_and_display_snapshot_match_reviewed_product(self):
        source = ROOT / "data/model/loggerhead-emodnet-2003-2018.nc.gz"
        manifest = json.loads((ROOT / "src/data/model/loggerhead-mediterranean.json").read_text())
        image = (ROOT / "src/data/model/loggerhead-mediterranean.png").read_bytes()

        self.assertEqual(hashlib.sha256(gzip.decompress(source.read_bytes())).hexdigest(), SOURCE_SHA256)
        self.assertEqual(manifest["source"]["sourceSha256"], SOURCE_SHA256)
        self.assertEqual(manifest["scientificName"], "Caretta caretta")
        self.assertEqual(manifest["boundsWgs84"], [-6.5, 30.0, 37.0, 46.0])
        self.assertEqual(manifest["rendering"]["units"], "unspecified by source; relative values only")
        self.assertEqual(image[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(struct.unpack(">II", image[16:24]), tuple(manifest["imageSize"]))
        self.assertEqual(image[25], 6)  # RGBA: unestimated water stays transparent.


if __name__ == "__main__":
    unittest.main()
