import { describe, expect, it } from "vitest";

describe("Modern collections — Map / Set / WeakMap / WeakSet (AAA)", () => {
  it("Map: key-value pairs of any type", () => {
    // Arrange
    const prices = new Map<string, number>();
    prices.set("coffee", 2000);
    prices.set("tea", 1500);

    // Action
    const coffee = prices.get("coffee");
    const total = Array.from(prices.values()).reduce((a, b) => a + b, 0);

    // Assert
    expect(coffee).toBe(2000);
    expect(total).toBe(3500);
  });

  it("Set: collection without duplicates", () => {
    // Arrange
    const ingredients = new Set(["water", "coffee", "water"]);

    // Action
    ingredients.add("milk");

    // Assert
    expect([...ingredients]).toEqual(["water", "coffee", "milk"]);
  });

  it("WeakMap: only accepts objects as keys", () => {
    // Arrange
    const wm = new WeakMap<object, string>();
    const obj = { id: 1 };

    // Action
    wm.set(obj, "saved");
    const value = wm.get(obj);

    // Assert
    expect(value).toBe("saved");
  });

  it("WeakSet: contains unique weak objects", () => {
    // Arrange
    const ws = new WeakSet<object>();
    const a = { id: 1 };
    const b = { id: 2 };

    // Action
    ws.add(a);
    const hasA = ws.has(a);
    const hasB = ws.has(b);

    // Assert
    expect(hasA).toBe(true);
    expect(hasB).toBe(false);
  });
});
