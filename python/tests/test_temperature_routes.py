import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class TemperatureRouteArtifactTests(unittest.TestCase):
    def test_routes_cover_every_region_and_trace_the_displayed_geometry(self):
        data = json.loads((ROOT/'src/data/temperatureRoutes.json').read_text())
        areas = json.loads((ROOT/'src/data/seaAreas.geojson').read_text())['features']
        ids = {f['properties']['id'] for f in areas} | {'caspian'}
        self.assertEqual({n['areaId'] for n in data['nodes']}, ids)
        self.assertEqual(len(data['nodes']), len(ids))
        for path, digest in data['provenance']['inputs'].items():
            self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(), digest)
        code = ROOT/'python/ocean_pipeline/temperature_routes.py'
        self.assertEqual(hashlib.sha256(code.read_bytes()).hexdigest(), data['provenance']['codeSha256'])
        self.assertTrue(all('caspian' not in (l['from'], l['to']) for l in data['links']))


@unittest.skipUnless(importlib.util.find_spec('shapely'), 'Install python[forecast] for geometry tests')
class TemperatureRouteGeometryTests(unittest.TestCase):
    def test_path_search_goes_around_a_land_barrier_instead_of_crossing_it(self):
        from shapely.geometry import LineString, box
        from ocean_pipeline.temperature_routes import connector
        water = box(-3, -3, 3, 3).difference(box(-.4, -2, .4, 2))
        route = connector(water, [-2, 0], [2, 0])
        self.assertIsNotNone(route)
        self.assertTrue(water.covers(LineString(route)))
        self.assertGreater(len(route), 2)

    def test_disconnected_water_cannot_produce_a_terrestrial_shortcut(self):
        from shapely.geometry import box
        from ocean_pipeline.temperature_routes import connector
        water = box(-3, -1, -2, 1).union(box(2, -1, 3, 1))
        self.assertIsNone(connector(water, [-2.5, 0], [2.5, 0]))
