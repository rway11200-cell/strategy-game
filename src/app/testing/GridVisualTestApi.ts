import type { CellCoord } from "../../grid/GridConfig";

export interface GridVisualFixture {
  viewport: { width: number; height: number; deviceScaleFactor: number };
  config: {
    columns: number;
    rows: number;
    tileSize: number;
    offsetX: number;
    offsetY: number;
  };
  cellTypes: string[][];
  path: CellCoord[];
  highlightedCell: CellCoord;
}

export interface GridVisualSnapshot {
  frame: number;
  canvas: {
    cssWidth: number;
    cssHeight: number;
    backingWidth: number;
    backingHeight: number;
  };
  layers: ["cells", "path", "highlight"];
  cellCount: number;
  path: CellCoord[];
  highlightedCell: CellCoord;
}

export interface GridVisualTestApi {
  renderFixture(fixture: GridVisualFixture): void;
  waitForRender(): Promise<GridVisualSnapshot>;
}

function notImplemented(method: keyof GridVisualTestApi): never {
  throw new Error(`GridVisualTestApi.${method} is not implemented`);
}

export function createGridVisualTestApi(): GridVisualTestApi {
  return {
    renderFixture(_fixture): void {
      return notImplemented("renderFixture");
    },
    waitForRender(): Promise<GridVisualSnapshot> {
      return notImplemented("waitForRender");
    },
  };
}

declare global {
  interface Window {
    __GRID_VISUAL_TEST__?: GridVisualTestApi;
  }
}
