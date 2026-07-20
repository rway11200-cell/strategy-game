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
    "hold-position-lane",
    {
      preset: "hold-position-lane",
      grid: { columns: 7, rows: 3, tileSize: 64 },
      landmarks: {
        ally: { col: 3, row: 1 },
        enemyStart: { col: 0, row: 0 },
        enemyEnd: { col: 6, row: 0 },
      },
      groups: {
        enemyPath: [
          { col: 1, row: 0 },
          { col: 2, row: 0 },
          { col: 3, row: 0 },
          { col: 4, row: 0 },
          { col: 5, row: 0 },
          { col: 6, row: 0 },
        ],
      },
      path: [],
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
  [
    "hold-fire-stationary",
    {
      preset: "hold-fire-stationary",
      grid: { columns: 5, rows: 5, tileSize: 64 },
      landmarks: {
        attacker: { col: 1, row: 2 },
        target: { col: 3, row: 2 },
      },
      groups: {},
      path: [],
      economy: { coins: 0 },
    },
  ],
  [
    "hold-fire-patrol",
    {
      preset: "hold-fire-patrol",
      grid: { columns: 7, rows: 3, tileSize: 64 },
      landmarks: {
        defender: { col: 3, row: 1 },
        patrolStart: { col: 0, row: 0 },
        patrolEnd: { col: 6, row: 0 },
      },
      groups: {},
      path: [],
      economy: { coins: 0 },
    },
  ],
  [
    "five-unit-contended-patrol",
    {
      preset: "five-unit-contended-patrol",
      grid: { columns: 9, rows: 7, tileSize: 64 },
      landmarks: {
        pointA: { col: 2, row: 3 },
        pointB: { col: 6, row: 3 },
      },
      groups: {
        spawnCells: [
          { col: 0, row: 1 },
          { col: 0, row: 2 },
          { col: 0, row: 3 },
          { col: 0, row: 4 },
          { col: 0, row: 5 },
        ],
      },
      path: [],
      economy: { coins: 0 },
    },
  ],
]);

export function getTestScenarioDefinition(
  preset: TestScenarioPreset,
): TestScenarioDefinition | undefined {
  return scenarios.get(preset);
}
