import { describe, expect, it } from "vitest";

describe("Basic types and inference in TypeScript (AAA)", () => {
  it("primitive types", () => {
    // Arrange
    const name: string = "Camila";
    const age: number = 28;
    const active: boolean = true;

    // Action
    const message = `${name} is ${age} years old, active: ${active}`;

    // Assert
    expect(message).toBe("Camila is 28 years old, active: true");
  });

  it("automatic type inference", () => {
    // Arrange
    const greeting = "Hello"; // TS infers string
    const amount = 5; // TS infers number

    // Action
    const result = `${greeting} (${typeof amount})`;

    // Assert
    expect(result).toBe("Hello (number)");
  });

  it("casting or 'as' to convert types", () => {
    // Arrange
    const value: unknown = "123";

    // Action
    const number = Number(value as string);

    // Assert
    expect(number).toBe(123);
  });

  it("uses enum to represent limited options", () => {
    // Arrange
    enum Status {
      Active = "active",
      Inactive = "inactive",
    }

    // Action
    const currentState: Status = Status.Active;

    // Assert
    expect(currentState).toBe("active");
  });
});
