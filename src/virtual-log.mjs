export const TRIAL_ROW_HEIGHT = 42;
export const TRIAL_RENDER_BUFFER = 8;

export function calculateVisibleRange({
  totalRows,
  scrollTop,
  viewportHeight,
  rowHeight = TRIAL_ROW_HEIGHT,
  buffer = TRIAL_RENDER_BUFFER
}) {
  const safeTotalRows = Math.max(0, Math.floor(totalRows));
  const safeRowHeight = Math.max(1, Math.floor(rowHeight));
  const safeViewportHeight = Math.max(0, Math.floor(viewportHeight));
  const firstVisible = Math.floor(Math.max(0, scrollTop) / safeRowHeight);
  const visibleCount = Math.ceil(safeViewportHeight / safeRowHeight);
  const start = Math.max(0, firstVisible - buffer);
  const end = Math.min(safeTotalRows, firstVisible + visibleCount + buffer);

  return {
    start,
    end,
    topSpacerHeight: start * safeRowHeight,
    bottomSpacerHeight: Math.max(0, (safeTotalRows - end) * safeRowHeight)
  };
}

