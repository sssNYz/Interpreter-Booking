export const MAX_LANES = 2; // lanes: 0, 1
export const ROW_HEIGHT = 60; // px
export const CELL_WIDTH = 120; // px (must match grid) - will be made responsive
export const DAY_LABEL_WIDTH = 120; // px (first column) - will be made responsive
export const BAR_HEIGHT = 12; // px
export const LANE_TOP_OFFSET = 8; // px (padding from top of row)
export const BAR_STACK_GAP = 20; // px (distance between lanes)

// Responsive breakpoints for calendar
export const RESPONSIVE_BREAKPOINTS = {
  sm: { cellWidth: 80, dayLabelWidth: 80 },
  md: { cellWidth: 100, dayLabelWidth: 100 },
  lg: { cellWidth: 120, dayLabelWidth: 120 },
  xl: { cellWidth: 140, dayLabelWidth: 140 },
} as const;