import { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";

describe("Pixi eventMode emit", () => {
  it("works with static eventMode", () => {
    const g = new Graphics().rect(0, 0, 100, 100).fill({ color: 0xff0000, alpha: 0 });
    g.eventMode = "static";

    const events: any[] = [];
    g.on("pointerdown", (e: any) => events.push(e));

    g.emit("pointerdown", { global: { x: 32, y: 32 } } as any);
    expect(events).toHaveLength(1);
  });

  it("works without eventMode set", () => {
    const g = new Graphics().rect(0, 0, 100, 100).fill({ color: 0xff0000, alpha: 0 });

    const events: any[] = [];
    g.on("pointerdown", (e: any) => events.push(e));

    g.emit("pointerdown", { global: { x: 32, y: 32 } } as any);
    expect(events).toHaveLength(1);
  });
});
