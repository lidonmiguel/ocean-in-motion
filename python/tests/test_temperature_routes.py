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
        self.assertGreaterEqual(len(data['nodes']), len(ids)*6)
        self.assertEqual(len({n['id'] for n in data['nodes']}), len(data['nodes']))
        for path, digest in data['provenance']['inputs'].items():
            self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(), digest)
        code = ROOT/'python/ocean_pipeline/temperature_routes.py'
        self.assertEqual(hashlib.sha256(code.read_bytes()).hexdigest(), data['provenance']['codeSha256'])
        self.assertTrue(all(not l['from'].startswith('caspian:') and not l['to'].startswith('caspian:') for l in data['links']))


@unittest.skipUnless(importlib.util.find_spec('shapely'), 'Install python[forecast] for geometry tests')
class TemperatureRouteGeometryTests(unittest.TestCase):
    def test_origins_span_the_water_instead_of_repeating_its_center(self):
        from shapely.geometry import Point, box
        from ocean_pipeline.temperature_routes import distributed_points
        water = box(-10, -5, 10, 5)
        origins = distributed_points(water, [0, 0], 12)
        self.assertEqual(len({tuple(p) for p in origins}), 12)
        self.assertTrue(all(water.covers(Point(p)) for p in origins))
        self.assertTrue(all(p != [0, 0] for p in origins))
        self.assertGreater(max(p[0] for p in origins)-min(p[0] for p in origins), 18)

    def test_open_water_routes_have_the_species_visual_bend_and_safe_endpoints(self):
        from shapely.geometry import LineString, box
        from ocean_pipeline.temperature_routes import curved_path, resample
        water = box(-20, -20, 20, 20)
        path = curved_path([[-5, 0], [-10, -10], [5, 0]], water, 0)
        self.assertEqual(path[0], [-5, 0])
        self.assertEqual(path[-1], [5, 0])
        self.assertGreater(max(abs(p[1]) for p in path), 1)
        self.assertGreaterEqual(min(p[1] for p in path), 0)  # no unnecessary hub detour
        self.assertTrue(water.covers(LineString(resample(path))))

    def test_proximity_is_measured_from_the_point_to_neighbor_water(self):
        from shapely.geometry import box
        from ocean_pipeline.temperature_routes import proximity
        neighbor = box(2, -2, 50, 2)
        self.assertAlmostEqual(proximity([1, 0], neighbor), 111.195, places=2)
        self.assertAlmostEqual(proximity([49, 0], neighbor), 0)

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
