import { describe, expect, it } from 'vitest';
import pilot from './observations/loggerhead-west-med.json';
import metadata from './speciesMetadata.json';
import tuna from './observations/tuna-west-med.json';
import whaleShark from './observations/whale-shark-gulf.json';
import swordfish from './observations/swordfish-west-med.json';
import humpback from './observations/humpback-gulf-maine.json';
import bottlenose from './observations/bottlenose-west-med.json';
import greenTurtle from './observations/green-turtle-caribbean.json';
import { species } from './index';
import { buildObservationScenario, enclosingObservationBox } from './observationScenario';
import { displayStreamlines } from './flowData';
import { waterSegment } from './oceanRoutes';

describe('one observation box per scoped source', () => {
  it('keeps all accepted positions inside their one displayed source square', () => {
    const snapshots = [tuna, whaleShark, swordfish, humpback, bottlenose, greenTurtle, pilot];
    for (const [index, scenario] of species.entries()) {
      const snapshot = snapshots[index];
      const box = scenario.habitat.current[0];
      expect(scenario.habitat.current, scenario.id).toHaveLength(1);
      expect(scenario.occurrence?.count).toBe(snapshot.observations.length);
      for (const record of snapshot.observations) {
        expect(Math.abs(record.longitude - box.center[0]), scenario.id).toBeLessThan(box.widthDeg / 2);
        expect(Math.abs(record.latitude - box.center[1]), scenario.id).toBeLessThan(box.heightDeg / 2);
      }
    }
  });
  it('encloses every original OBIS position in a single square near the ferry route', () => {
    const box = enclosingObservationBox(pilot.observations);
    expect(box.observedBoundsWgs84).toEqual([2.41215, 41.110438, 11.422413, 41.99854]);
    expect(box.center[0]).toBeGreaterThan(2);
    expect(box.center[0]).toBeLessThan(12);
    const [lon, lat] = box.center;
    for (const row of pilot.observations) {
      expect(Math.abs(row.longitude - lon)).toBeLessThan(box.widthDeg / 2);
      expect(Math.abs(row.latitude - lat)).toBeLessThan(box.heightDeg / 2);
    }
    const kmAcross = box.widthDeg * 111.32 * Math.cos(lat * Math.PI / 180);
    expect(kmAcross).toBeCloseTo(box.heightDeg * 111.32, 6);
  });

  it('routes the illustrative future over water without claiming a forecast', () => {
    const scenario = species.find(item => item.id === 'loggerhead-turtle')!;
    expect(scenario.habitat.current).toHaveLength(1);
    expect(scenario.habitat.future[0].center).toEqual([
      scenario.habitat.current[0].center[0], scenario.habitat.current[0].center[1] - 2
    ]);
    expect(scenario.citations.map(c => c.role)).toContain('occurrence');
    const routes = displayStreamlines(scenario);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every(route => route.path.slice(1).every((point, i) => waterSegment(route.path[i], point)))).toBe(true);
  });

  it('builds one additional box when a separate scoped dataset is registered', () => {
    const second = {
      ...pilot, source: { ...pilot.source, datasetId: 'second-region', url: 'https://obis.org/dataset/second-region' },
      observations: pilot.observations.map(row => ({ ...row, id: `other-${row.id}`, longitude: row.longitude + 1 }))
    };
    const scenario = buildObservationScenario(metadata.find(item => item.id === 'loggerhead-turtle')! as Parameters<typeof buildObservationScenario>[0], [pilot, second], [0, -2]);
    expect(scenario.occurrence?.count).toBe(234);
    expect(scenario.habitat.current).toHaveLength(2);
    expect(scenario.habitat.future).toHaveLength(2);
  });
});
