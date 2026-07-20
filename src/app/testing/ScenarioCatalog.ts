import type { CellCoord } from "../../grid/GridConfig";
import type { TestScenarioPreset } from "./GameTestApi";

export interface TestScenarioDefinition {
  preset: TestScenarioPreset;
  grid: {
    columns: number;
    rows: number;
    tileSize: number;
  };
  landmarks: Record<string, CellCoord>;
  groups: Record<string, CellCoord[]>;
  path: CellCoord[];
  economy: { coins: number };
  cellTypes?: Record<string, string>;
}

const scenarios = new Map<TestScenarioPreset, TestScenarioDefinition>([
  [
    "three-cell-patrol-corridor",
    {
      preset: "three-cell-patrol-corridor",
      grid: { columns: 3, rows: 1, tileSize: 64 },
      landmarks: {
        start: { col: 0, row: 0 },
        intermediate: { col: 1, row: 0 },
        end: { col: 2, row: 0 },
      },
      groups: {},
      path: [
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ],
      economy: { coins: 0 },
    },
  ],
  [
    "long-movement-corridor",
    {
      preset: "long-movement-corridor",
      grid: { columns: 5, rows: 1, tileSize: 64 },
      landmarks: {
        origin: { col: 0, row: 0 },
        checkpoint: { col: 2, row: 0 },
        destination: { col: 4, row: 0 },
      },
      groups: {},
      path: [
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
        { col: 3, row: 0 },
        { col: 4, row: 0 },
      ],
      economy: { coins: 0 },
    },
  ],
  [
    "tower-placement",
    {
      preset: "tower-placement",
      grid: { columns: 4, rows: 4, tileSize: 64 },
      landmarks: { buildCell: { col: 1, row: 1 } },
      groups: {},
      path: [],
      economy: { coins: 500 },
    },
  ],
]);

export function getTestScenarioDefinition(
  preset: TestScenarioPreset,
): TestScenarioDefinition | undefined {
  return scenarios.get(preset);
}
