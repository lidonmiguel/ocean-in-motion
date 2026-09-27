import { describe, expect, it } from 'vitest';
import { curveOceanRoute, isOcean, oceanRoute, waterSegment } from './oceanRoutes';
import tuna from './species/tuna.json';
import turtle from './species/turtle.json';
import shark from './species/whale-shark.json';

describe('water-only display routes', () => {
  it('recognizes the coastline used by the map', () => {
    expect(isOcean([-87, 20])).toBe(true);
    expect(isOcean([-82, 26])).toBe(true);
    expect(isOcean([-80, 22])).toBe(false); // Cuba
    expect(waterSegment([-83, 20], [-79, 25])).toBe(false);
    expect(isOcean([-100, 40])).toBe(false); // North America
    expect(isOcean([10, 50])).toBe(false); // Europe
    expect(isOcean([139, 36])).toBe(false); // Japan
    expect(isOcean([180, 0])).toBe(true); // Pacific / antimeridian
  });

  it('routes around the Florida–Cuba land barrier without crossing it', () => {
    const from: [number, number] = [-83, 20];
    const to: [number, number] = [-79, 25];
    const route = oceanRoute(from, to);
    expect(route).not.toBeNull();
    expect(route?.[0]).toEqual(from);
    expect(route?.at(-1)).toEqual(to);
    for (let i = 1; i < route!.length; i++) expect(waterSegment(route![i - 1], route![i])).toBe(true);
  });

  it('makes an open-ocean stroke visibly curved while retaining water-only endpoints', () => {
    const route = oceanRoute([-40, 30], [-30, 40])!;
    const curved = curveOceanRoute(route, 0);
    expect(curved[0]).toEqual(route[0]);
    expect(curved.at(-1)).toEqual(route.at(-1));
    const middle = Math.floor(route.length / 2);
    expect(Math.hypot(curved[middle][0] - route[middle][0], curved[middle][1] - route[middle][1])).toBeGreaterThan(0.8);
    for (let i = 1; i < curved.length; i++) expect(waterSegment(curved[i - 1], curved[i])).toBe(true);
  });

  it('keeps a coastal curve entirely offshore', () => {
    const route = oceanRoute([-83, 20], [-79, 25])!;
    const curved = curveOceanRoute(route, 1);
    for (let i = 1; i < curved.length; i++) expect(waterSegment(curved[i - 1], curved[i])).toBe(true);
  });

  it('never draws from an endpoint on land', () => {
    expect(oceanRoute([-80, 22], [-87, 20])).toBeNull();
  });

  it('takes the short water crossing at the antimeridian', () => {
    const route = oceanRoute([179, 0], [-179, 0]);
    expect(route).not.toBeNull();
    expect(route?.at(-1)?.[0]).toBeCloseTo(181);
    for (let i = 1; i < route!.length; i++) expect(waterSegment(route![i - 1], route![i])).toBe(true);
  });

  it('keeps the fixture cell centers at sea', () => {
    for (const fixture of [tuna, turtle, shark]) {
      for (const cell of [...fixture.habitat.current, ...fixture.habitat.future]) {
        expect(isOcean(cell.center as [number, number]), `${fixture.id}: ${cell.id}`).toBe(true);
      }
    }
  });
});
