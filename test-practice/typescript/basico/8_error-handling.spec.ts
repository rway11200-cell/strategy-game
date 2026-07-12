import { describe, expect, it } from "vitest";

describe("Error handling — try/catch/finally, throw, custom errors (AAA)", () => {
  it("try/catch: catches an error thrown with throw", () => {
    // Arrange
    const divide = (a: number, b: number) => {
      if (b === 0) throw new Error("Division by zero");
      return a / b;
    };

    // Action
    const success = divide(10, 2);
    let errorMessage = "";
    try {
      divide(10, 0);
    } catch (e) {
      errorMessage = (e as Error).message;
    }

    // Assert
    expect(success).toBe(5);
    expect(errorMessage).toBe("Division by zero");
  });

  it("finally: always executes", () => {
    // Arrange
    const steps: string[] = [];

    // Action
    try {
      steps.push("try");
      throw new Error("Fail");
    } catch {
      steps.push("catch");
    } finally {
      steps.push("finally");
    }

    // Assert
    expect(steps).toEqual(["try", "catch", "finally"]);
  });

  it("custom errors with classes and instanceof", () => {
    // Arrange
    class ValidationError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = "ValidationError";
      }
    }

    const validateAge = (age: number) => {
      if (age < 0) throw new ValidationError("Invalid age");
      return true;
    };

    // Action
    let caughtType = "";
    try {
      validateAge(-1);
    } catch (e) {
      if (e instanceof ValidationError) caughtType = "ValidationError";
    }

    // Assert
    expect(caughtType).toBe("ValidationError");
  });

  it("promises: rejection and handling with catch/await", async () => {
    // Arrange
    const failAsync = () => Promise.reject(new Error("Async fail"));

    // Action
    let message = "";
    try {
      await failAsync();
    } catch (e) {
      message = (e as Error).message;
    }

    // Assert
    expect(message).toBe("Async fail");
  });
});
