import { describe, expect, it } from 'vitest';
import metadata from './speciesMetadata.json';
import { sourceLayers, species } from './index';
import { areasOverlap, buildObservationScenario, enclosingObservationBox, observationGroups, regionalObservationGroups, type ObservationSnapshot } from './observationScenario';
import { displayStreamlines } from './flowData';
import { waterSegment } from './oceanRoutes';

const pilot = sourceLayers.find(([id]) => id === 'loggerhead-turtle')![1][0];

describe('one observation box per scoped source', () => {
  it('keeps all accepted positions inside their matching regional source square', () => {
    const snapshots: ObservationSnapshot[][] = sourceLayers.map(([, sources]) => sources);
    for (const [index, scenario] of species.entries()) {
      const groups = snapshots[index].flatMap(snapshot => regionalObservationGroups(snapshot).map(({ records }) => ({ snapshot, records })));
      expect(scenario.habitat.current, scenario.id).toHaveLength(groups.length);
      expect(scenario.occurrence?.count).toBe(snapshots[index].reduce((sum, snapshot) => sum + snapshot.observations.length, 0));
      expect(new Set(scenario.habitat.current.map(cell => cell.id)).size).toBe(groups.length);
      for (const [sourceIndex, { snapshot, records }] of groups.entries()) {
        const box = scenario.habitat.current[sourceIndex];
        expect(box.id).toBe(scenario.occurrence?.sources[sourceIndex].boxId);
        expect(scenario.occurrence?.sources[sourceIndex].datasetId).toBe(snapshot.source.datasetId);
        expect(scenario.occurrence?.sources[sourceIndex].count).toBe(records.length);
        for (const record of records) {
          expect(Math.abs(record.longitude - box.center[0]), scenario.id).toBeLessThan(box.widthDeg / 2);
          expect(Math.abs(record.latitude - box.center[1]), scenario.id).toBeLessThan(box.heightDeg / 2);
        }
      }
    }
  });

  it('keeps each visual destination outside every observed area of its species', () => {
    for (const scenario of species) {
      for (const future of scenario.habitat.future) {
        expect(scenario.habitat.current.some(current => areasOverlap(current, future)), scenario.id).toBe(false);
      }
      for (const source of scenario.occurrence!.sources) {
        expect(scenario.habitat.future.some(cell => cell.id === source.boxId))
          .toBe(source.simulationOffsetDeg !== null);
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

  it('enlarges the display square while retaining the exact observed extrema', () => {
    const two = [
      { id: 'a', longitude: -30, latitude: 0, eventDate: '2020-01-01', coordinateUncertaintyInMeters: null },
      { id: 'b', longitude: -29.9, latitude: 0, eventDate: '2020-01-02', coordinateUncertaintyInMeters: null }
    ];
    const box = enclosingObservationBox(two);
    expect(box.widthDeg).toBeGreaterThan(4);
    expect(box.observedBoundsWgs84).toEqual([-30, 0, -29.9, 0]);
  });

  it('routes the illustrative future over water without claiming a forecast', () => {
    const scenario = species.find(item => item.id === 'loggerhead-turtle')!;
    expect(scenario.habitat.current.length).toBeGreaterThan(1);
    const future = scenario.habitat.future[0];
    const start = scenario.habitat.current.find(cell => cell.id === future.id)!.center;
    const finish = future.center;
    expect(Math.hypot(finish[0] - start[0], finish[1] - start[1])).toBeGreaterThan(4);
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
    expect(scenario.habitat.future.length).toBeLessThanOrEqual(2);
  });

  it('separates distant sightings within one dataset without one box per nearby record', () => {
    const groups = observationGroups([
      { id: 'a', longitude: 0, latitude: 0, eventDate: '2020-01-01', coordinateUncertaintyInMeters: null },
      { id: 'b', longitude: 4, latitude: 0, eventDate: '2020-01-02', coordinateUncertaintyInMeters: null },
      { id: 'c', longitude: 8, latitude: 0, eventDate: '2020-01-03', coordinateUncertaintyInMeters: null }
    ], 500);
    expect(groups.map(group => group.map(record => record.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('groups nearby records into a broader region without joining a distant record', () => {
    const observations = [-30, -25, -10].map((longitude, i) => ({
      id: `point-${i}`, longitude, latitude: 0, eventDate: '2020-01-01', coordinateUncertaintyInMeters: null
    }));
    const snapshot = { ...pilot, clusterDiameterKm: 800, observations };
    const groups = regionalObservationGroups(snapshot);
    expect(groups.map(group => group.records.length)).toEqual([2, 1]);
    expect(groups[0].box.widthDeg).toBeGreaterThan(9);
  });
});
