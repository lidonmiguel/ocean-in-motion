type Position = [number, number];
export type DisplayFlow = { id: string; from: Position; to: Position; path: Position[] };

// Visual timing, path window and palette for the ocean temperature traces.
export const FLOW_CYCLE_SECONDS = 5.6;
export const FLOW_SPAN_DEGREES = 12;
export const FLOW_STYLE = {
  width: 1.8, glowWidth: 5, glowColor: [119, 222, 222, 24] as [number, number, number, number],
  sourceColor: [60, 237, 224] as [number, number, number],
  destinationColor: [255, 107, 180] as [number, number, number]
};
export type FlowSegment = { path: [number, number][]; color: [number, number, number, number] };

export function flowSegments(flow: DisplayFlow, start: number, end: number,
  sourceColor = FLOW_STYLE.sourceColor, alpha = 1): FlowSegment[] {
  return Array.from({ length: 3 }, (_, index) => {
    const from = Math.max(start, index / 3);
    const to = Math.min(end, (index + 1) / 3);
    if (to <= from) return null;
    const blend = (index + 0.5) / 3;
    return { path: flowSection(flow, from, to), color: [
      ...sourceColor.map((channel, i) => Math.round(channel * (1 - blend) + FLOW_STYLE.destinationColor[i] * blend)),
      Math.round(245 * alpha)
    ] as [number, number, number, number] };
  }).filter((segment): segment is FlowSegment => segment !== null);
}

export function growingFlowFrame(flow: DisplayFlow, progress: number, alpha = 1) {
  const [start, end] = visibleFlowWindow(progress);
  return end - start < 0.015 ? { path: [], segments: [] } : {
    path: flowSection(flow, start, end), segments: flowSegments(flow, start, end, undefined, alpha)
  };
}

export function pointOnFlow(flow: DisplayFlow, progress: number): Position {
  const location = Math.max(0, Math.min(1, progress)) * (flow.path.length - 1);
  const before = Math.floor(location);
  const after = Math.min(before + 1, flow.path.length - 1);
  const fraction = location - before;
  return [
    flow.path[before][0] + (flow.path[after][0] - flow.path[before][0]) * fraction,
    flow.path[before][1] + (flow.path[after][1] - flow.path[before][1]) * fraction
  ];
}

// The growing line starts at the source, then its tail follows the tip until
// both reach the destination. No part of the route remains on screen afterward.
export function visibleFlowWindow(progress: number): [number, number] {
  const end = Math.max(0, Math.min(1, progress));
  const start = end <= 0.82 ? 0 : (end - 0.82) / 0.18;
  return [Math.min(start, end), end];
}

export function flowSection(flow: DisplayFlow, from: number, to: number): Position[] {
  const start = Math.max(0, Math.min(1, from));
  const end = Math.max(start, Math.min(1, to));
  const lastIndex = flow.path.length - 1;
  const interior = flow.path.filter((_, index) => index / lastIndex > start && index / lastIndex < end);
  return [pointOnFlow(flow, start), ...interior, pointOnFlow(flow, end)];
}
