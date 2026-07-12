import { describe, expect, it } from "vitest";

describe("Various useful concepts (AAA)", () => {
  it("ternary operator", () => {
    // Arrange
    const age = 20;

    // Action
    const permission = age >= 18 ? "adult" : "minor";

    // Assert
    expect(permission).toBe("adult");
  });

  it("optional chaining and nullish coalescing", () => {
    // Arrange
    const user: any = { profile: null };

    // Action
    const commune = user.profile?.address?.commune ?? "Unknown";

    // Assert
    expect(commune).toBe("Unknown");
  });

  it("template literals", () => {
    // Arrange
    const name = "Seba";
    const age = 30;

    // Action
    const text = `Hello ${name}, you are ${age} years old.`;

    // Assert
    expect(text).toBe("Hello Seba, you are 30 years old.");
  });

  it("spread and immutable copy", () => {
    // Arrange
    const base = { name: "Cami", age: 28 };
    const extra = { city: "Buin" };

    // Action
    const combined = { ...base, ...extra };

    // Assert
    expect(combined).toEqual({ name: "Cami", age: 28, city: "Buin" });
    expect(base).toEqual({ name: "Cami", age: 28 }); // not mutated
  });
});
