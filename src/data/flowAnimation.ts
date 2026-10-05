import { flowSection, visibleFlowWindow, type DisplayFlow } from './flowData';

// Shared by the species and temperature maps so their visual language agrees.
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
