import { Container, Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";

describe("Pixi container children emit", () => {
  it("emit works when graphic is child of container", () => {
    const g = new Graphics().rect(0, 0, 100, 100).fill({ color: 0xff0000, alpha: 0 });
    g.eventMode = "static";
    const events: any[] = [];
    g.on("pointerdown", (e: any) => events.push(e));

    const container = new Container();
    container.addChild(g);
    
    g.emit("pointerdown", { global: { x: 32, y: 32 } } as any);
    expect(events).toHaveLength(1);
  });

  it("emit on overlay retrieved from class method", () => {
    const g = new Graphics().rect(0, 0, 100, 100).fill({ color: 0xff0000, alpha: 0 });
    g.eventMode = "static";

    const container = new Container();
    container.addChild(g);

    const events: any[] = [];
    // Simulate what CellEvents does: register listener then call via getOverlay()
    class TestEvents {
      private overlay = g;
      attach(c: Container) {
        c.addChild(this.overlay);
        this.overlay.on("pointerdown", (e: any) => events.push(e));
      }
      getOverlay() { return this.overlay; }
    }
    const te = new TestEvents();
    te.attach(container);
    te.getOverlay().emit("pointerdown", { global: { x: 32, y: 32 } } as any);
    expect(events).toHaveLength(1);
  });
});
