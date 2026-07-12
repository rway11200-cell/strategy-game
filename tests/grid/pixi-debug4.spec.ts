import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { CellEvents } from "../../src/grid/CellEvents";
import { createGridConfig } from "../../src/core/grid/GridConfig";

describe("CellEvents pinpoint", () => {
  it("listener fires after attach", () => {
    const config = createGridConfig({ cellSize: 64, gridWidth: 3, gridHeight: 3, offsetX: 0, offsetY: 0 });
    const clicked: any[] = [];
    const events = new CellEvents(config, { onClick: (c) => clicked.push(c) });
    const container = new Container();
    events.attach(container);

    const overlay = events.getOverlay();

    // Directly register a test listener to verify the overlay is functional
    let rawHit = false;
    overlay.on("raw-test", () => { rawHit = true; });
    overlay.emit("raw-test", {});
    expect(rawHit).toBe(true);

    // Now test the actual pointerdown
    overlay.emit("pointerdown", { global: { x: 32, y: 32 } } as any);
    expect(clicked).toHaveLength(1);
  });

  it("basic standalone Graphics emit works", () => {
    const { Graphics } = require("pixi.js");
    const g = new Graphics().rect(0, 0, 100, 100).fill({ color: 0xffffff, alpha: 0 });
    g.eventMode = "static";
    g.cursor = "pointer";
    
    const events: any[] = [];
    g.on("pointerdown", (e: any) => events.push(e));

    const container = new Container();
    container.addChild(g);
    
    g.emit("pointerdown", { global: { x: 32, y: 32 } } as any);
    expect(events).toHaveLength(1);
  });
});
