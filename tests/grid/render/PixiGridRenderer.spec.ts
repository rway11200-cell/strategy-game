import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { createDefaultGridConfig } from "../../../src/grid/GridConfig";
import { PixiGridRenderer } from "../../../src/grid/render/PixiGridRenderer";
import { gridStateToCellData } from "../../../src/grid/render/cellDataBridge";
import type { CellRenderData } from "../../../src/grid/render/GridRenderAdapter";

function makeConfig() {
  return createDefaultGridConfig({ gridWidth: 3, gridHeight: 3, cellSize: 32 });
}

function buildCellData(): CellRenderData[][] {
  const data: CellRenderData[][] = [];
  for (let r = 0; r < 3; r++) {
    const row: CellRenderData[] = [];
    for (let c = 0; c < 3; c++) {
      row.push({
        col: c,
        row: r,
        type: "walkable",
        occupied: false,
        walkCost: 1,
      });
    }
    data.push(row);
  }
  return data;
}

describe("PixiGridRenderer", () => {
  it("renders cells into the container", () => {
    const container = new Container();
    const renderer = new PixiGridRenderer(container, makeConfig());

    renderer.render(buildCellData());
    expect(container.children.length).toBeGreaterThan(0);
  });

  it("clear removes all graphics", () => {
    const container = new Container();
    const renderer = new PixiGridRenderer(container, makeConfig());

    renderer.render(buildCellData());
    renderer.clear();

    expect(container.children.length).toBe(3);
  });

  it("highlightPath draws into the container", () => {
    const container = new Container();
    const renderer = new PixiGridRenderer(container, makeConfig());

    renderer.highlightPath([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ]);

    expect(container.children.length).toBe(3);
  });

  it("highlightCell draws on the highlight layer", () => {
    const container = new Container();
    const renderer = new PixiGridRenderer(container, makeConfig());

    renderer.highlightCell({ col: 1, row: 1 });
    renderer.clearHighlights();
  });

  it("destroy cleans up resources", () => {
    const container = new Container();
    const renderer = new PixiGridRenderer(container, makeConfig());

    renderer.render(buildCellData());
    renderer.destroy();

    expect(container.children.length).toBe(0);
  });

  it("render twice replaces previous content", () => {
    const container = new Container();
    const renderer = new PixiGridRenderer(container, makeConfig());

    renderer.render(buildCellData());
    renderer.render(buildCellData());

    expect(container.children.length).toBe(3);
  });
});

describe("gridStateToCellData", () => {
  it("converts a cell matrix preserving col/row", () => {
    const cells = [
      [
        { type: "walkable" as const, occupied: false, walkCost: 1 },
        { type: "blocked" as const, occupied: false, walkCost: 99 },
      ],
      [
        { type: "spawn" as const, occupied: true, occupantId: "e1", walkCost: 1 },
        null,
      ],
    ] as (Record<string, unknown> | null)[][];

    const result = gridStateToCellData(cells);
    expect(result[0][0]).toMatchObject({ col: 0, row: 0, type: "walkable" });
    expect(result[0][1]).toMatchObject({ col: 1, row: 0, type: "blocked" });
    expect(result[1][0]).toMatchObject({ col: 0, row: 1, type: "spawn", occupied: true, occupantId: "e1" });
    expect(result[1][1]).toMatchObject({ col: 1, row: 1, type: "blocked", occupied: false });
  });
});
