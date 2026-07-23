import type { CellCoord, CellType } from "../../grid/GridConfig";
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
  cellTypes?: Record<string, CellType>;
  structures?: TestScenarioStructure[];
}

export interface TestScenarioStructure {
  id: string;
  cell: CellCoord;
  footprint: { width: number; height: number };
  production?: {
    archetype: string;
    team: "player" | "enemy" | "neutral";
    intervalFrames: number;
  };
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
  [
    "spawn-collision-grid",
    {
      preset: "spawn-collision-grid",
      grid: { columns: 4, rows: 4, tileSize: 64 },
      landmarks: {
        cellA: { col: 0, row: 0 },
        cellB: { col: 1, row: 0 },
        cellC: { col: 2, row: 0 },
      },
      groups: {},
      path: [],
      economy: { coins: 0 },
    },
  ],
  [
    "two-unit-convoy",
    {
      preset: "two-unit-convoy",
      grid: { columns: 5, rows: 3, tileSize: 64 },
      landmarks: {
        leadStart: { col: 0, row: 1 },
        trailStart: { col: 1, row: 1 },
        destination: { col: 4, row: 1 },
      },
      groups: {},
      path: [],
      economy: { coins: 0 },
    },
  ],
  [
    "five-unit-march",
    {
      preset: "five-unit-march",
      grid: { columns: 10, rows: 5, tileSize: 64 },
      landmarks: {
        destination: { col: 9, row: 2 },
      },
      groups: {
        spawnCells: [
          { col: 0, row: 0 },
          { col: 0, row: 1 },
          { col: 0, row: 2 },
          { col: 0, row: 3 },
          { col: 0, row: 4 },
        ],
      },
      path: [],
      economy: { coins: 0 },
    },
  ],
  [
    "dense-occupation",
    {
      preset: "dense-occupation",
      grid: { columns: 9, rows: 9, tileSize: 32 },
      landmarks: {
        destination: { col: 7, row: 7 },
      },
      groups: {
        spawnCells: [
          { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 },
          { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
          { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 },
        ],
      },
      path: [],
      economy: { coins: 0 },
    },
  ],
  [
    "follow-the-leader",
    {
      preset: "follow-the-leader",
      grid: { columns: 5, rows: 5, tileSize: 32 },
      landmarks: {
        start: { col: 0, row: 2 },
        destination: { col: 4, row: 2 },
      },
      groups: {},
      path: [],
      economy: { coins: 0 },
    },
  ],
  [
    "spawn-point-demo",
    {
      preset: "spawn-point-demo",
      grid: { columns: 7, rows: 7, tileSize: 64 },
      landmarks: {
        spawnPoint: { col: 1, row: 1 },
      },
      groups: {},
      path: [],
      economy: { coins: 100 },
      cellTypes: {
        "0,0": "blocked",
      },
      structures: [{
        id: "spawn-point",
        cell: { col: 1, row: 1 },
        footprint: { width: 3, height: 3 },
        production: { archetype: "soldier", team: "player", intervalFrames: 90 },
      }],
    },
  ],
  [
    "blocked-route-detour",
    {
      preset: "blocked-route-detour",
      grid: { columns: 7, rows: 5, tileSize: 64 },
      landmarks: {
        origin: { col: 0, row: 2 },
        destination: { col: 6, row: 2 },
        detourGate: { col: 3, row: 0 },
        fallback: { col: 6, row: 1 },
      },
      groups: {},
      path: [],
      economy: { coins: 0 },
      cellTypes: {
        "3,1": "blocked",
        "3,2": "blocked",
        "3,3": "blocked",
        "3,4": "blocked",
      },
    },
  ],
]);

export function getTestScenarioDefinition(
  preset: TestScenarioPreset,
): TestScenarioDefinition | undefined {
  return scenarios.get(preset);
}
