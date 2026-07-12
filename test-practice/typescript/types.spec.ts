import { describe, expect, it } from "vitest";

describe("TS Types — basic examples (AAA)", () => {
  it("uses alias with union type", () => {
    // Arrange
    type ID = string | number;
    const valueA: ID = 123;
    const valueB: ID = "abc";

    // Action
    const combined = String(valueA) + valueB;

    // Assert
    expect(combined).toBe("123abc");
  });

  it("uses intersection type", () => {
    // Arrange
    type WithDates = { createdAt: Date };
    type User = { name: string } & WithDates;
    const user: User = { name: "Camila", createdAt: new Date() };

    // Assert
    expect(user.name).toBe("Camila");
  });

  it("uses generic to wrap a value", () => {
    // Arrange
    function wrap<T>(value: T) {
      return { value };
    }

    // Action
    const result = wrap({ x: 1 });

    // Assert
    expect(result.value.x).toBe(1);
  });
});
