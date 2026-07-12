import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { createGridConfig } from "../../src/core/grid/GridConfig";
import { CellData, GridRenderer } from "../../src/core/grid/GridRenderer";

function buildTestGrid(rows: number, cols: number): CellData[][] {
  const grid: CellData[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: CellData[] = [];
    for (let c = 0; c < cols; c++) {
      const type =
        r === 0 && c === 0
          ? "spawn"
          : r === rows - 1 && c === cols - 1
            ? "base"
            : r % 2 === 0 && c % 2 === 0
              ? "tower"
              : "walkable";
      row.push({ x: c, y: r, type, walkable: type === "walkable", weight: 1 });
    }
    grid.push(row);
  }
  return grid;
}

describe("GridRenderer", () => {
  it("renders a 5x5 grid and creates graphics in the container", () => {
    const config = createGridConfig({ cellSize: 32, gridWidth: 5, gridHeight: 5 });
    const renderer = new GridRenderer(config);
    const container = new Container();

    const data = buildTestGrid(5, 5);
    renderer.render(data, container);

    expect(container.children.length).toBe(50);
    renderer.clear();
    expect(container.children.length).toBe(0);
  });

  it("render twice replaces old graphics", () => {
    const config = createGridConfig({ cellSize: 32, gridWidth: 3, gridHeight: 3 });
    const renderer = new GridRenderer(config);
    const container = new Container();

    const data = buildTestGrid(3, 3);
    renderer.render(data, container);
    expect(container.children.length).toBe(18);

    renderer.render(data, container);
    expect(container.children.length).toBe(18);
  });

  it("clear leaves container empty", () => {
    const config = createGridConfig({ cellSize: 32, gridWidth: 4, gridHeight: 4 });
    const renderer = new GridRenderer(config);
    const container = new Container();

    const data = buildTestGrid(4, 4);
    renderer.render(data, container);
    renderer.clear();

    expect(container.children.length).toBe(0);
  });
});
