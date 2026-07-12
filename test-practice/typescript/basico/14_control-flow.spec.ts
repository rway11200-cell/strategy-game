import { describe, expect, it } from "vitest";

describe("Control structures — conditionals, loops and flow (AAA)", () => {
  it("if / else if / else", () => {
    // Arrange
    const temperature = 32;

    // Action
    let state = "";
    if (temperature > 30) state = "hot";
    else if (temperature >= 15) state = "mild";
    else state = "cold";

    // Assert
    expect(state).toBe("hot");
  });

  it("switch: selects by case", () => {
    // Arrange
    const day: string = "saturday";

    // Action
    let type = "";
    switch (day) {
      case "monday":
      case "tuesday":
      case "wednesday":
      case "thursday":
      case "friday":
        type = "weekday";
        break;
      case "saturday":
      case "sunday":
        type = "weekend";
        break;
      default:
        type = "unknown";
    }

    // Assert
    expect(type).toBe("weekend");
  });

  it("logical operators AND / OR / NOT", () => {
    // Arrange
    const isCustomer = true;
    const hasDiscount = false;
    const coupon = true;

    // Action
    const canBuy = isCustomer && (hasDiscount || coupon);
    const restricted = !isCustomer;

    // Assert
    expect(canBuy).toBe(true);
    expect(restricted).toBe(false);
  });

  it("for: iterates a fixed number of times", () => {
    // Arrange
    const numbers = [1, 2, 3];
    let sum = 0;

    // Action
    for (let i = 0; i < numbers.length; i++) {
      sum += numbers[i];
    }

    // Assert
    expect(sum).toBe(6);
  });

  it("for...of: iterates over array values", () => {
    // Arrange
    const letters = ["a", "b", "c"];
    let result = "";

    // Action
    for (const letter of letters) {
      result += letter;
    }

    // Assert
    expect(result).toBe("abc");
  });

  it("for...in: iterates over object keys", () => {
    // Arrange
    const coffee = { type: "espresso", price: 2000 };
    const keys: string[] = [];

    // Action
    for (const k in coffee) {
      keys.push(k);
    }

    // Assert
    expect(keys).toContain("type");
    expect(keys).toContain("price");
  });

  it("while: repeats while a condition is true", () => {
    // Arrange
    let n = 3;
    let result = 1;

    // Action
    while (n > 0) {
      result *= n;
      n--;
    }

    // Assert
    expect(result).toBe(6);
  });

  it("do...while: executes at least once", () => {
    // Arrange
    let counter = 0;
    let result = "";

    // Action
    do {
      result += "X";
      counter++;
    } while (counter < 3);

    // Assert
    expect(result).toBe("XXX");
  });

  it("break: interrupts the loop", () => {
    // Arrange
    const numbers = [1, 2, 3, 4, 5];
    let found = 0;

    // Action
    for (const n of numbers) {
      if (n === 3) {
        found = n;
        break;
      }
    }

    // Assert
    expect(found).toBe(3);
  });

  it("continue: skips to next iteration", () => {
    // Arrange
    const nums = [1, 2, 3, 4];
    const evens: number[] = [];

    // Action
    for (const n of nums) {
      if (n % 2 !== 0) continue;
      evens.push(n);
    }

    // Assert
    expect(evens).toEqual([2, 4]);
  });

  it("return: terminates function execution", () => {
    // Arrange
    const find = (list: string[], value: string) => {
      for (const el of list) {
        if (el === value) return true;
      }
      return false;
    };

    // Action
    const exists = find(["a", "b", "c"], "b");

    // Assert
    expect(exists).toBe(true);
  });

  it("try + conditional: combines control and errors", () => {
    // Arrange
    const divide = (a: number, b: number) => {
      if (b === 0) throw new Error("Division by zero");
      return a / b;
    };

    // Action
    let result: number | string;
    try {
      result = divide(10, 2);
    } catch (e) {
      result = (e as Error).message;
    }

    // Assert
    expect(result).toBe(5);
  });
});
