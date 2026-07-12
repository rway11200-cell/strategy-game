import { describe, expect, it } from "vitest";

describe("Classes and modifiers — public/private/protected/static/get/set (AAA)", () => {
  it("public/private/get/set: simple encapsulation", () => {
    // Arrange
    class Account {
      public holder: string;
      private _balance: number = 0;

      constructor(holder: string) {
        this.holder = holder;
      }

      get balance() {
        return this._balance;
      }

      set balance(value: number) {
        if (value < 0) throw new Error("Negative balance");
        this._balance = value;
      }

      deposit(amount: number) {
        this.balance = this._balance + amount;
      }
    }

    // Action
    const c = new Account("Camila");
    c.deposit(100);

    // Assert
    expect(c.holder).toBe("Camila");
    expect(c.balance).toBe(100);
  });

  it("protected and inheritance + super()", () => {
    // Arrange
    class Base {
      protected format(msg: string) {
        return `[Base] ${msg}`;
      }
    }

    class Child extends Base {
      greet() {
        return this.format("hello");
      }
    }

    // Action
    const h = new Child();
    const text = h.greet();

    // Assert
    expect(text).toBe("[Base] hello");
  });

  it("static and readonly: class members and constants", () => {
    // Arrange
    class Config {
      static readonly version = "1.0.0";
      readonly name: string;

      constructor(name: string) {
        this.name = name;
      }
    }

    // Action
    const conf = new Config("App");

    // Assert
    expect(Config.version).toBe("1.0.0");
    expect(conf.name).toBe("App");
  });
});
