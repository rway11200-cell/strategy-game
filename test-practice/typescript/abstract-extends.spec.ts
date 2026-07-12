import { describe, expect, it } from "vitest";

describe("Abstract classes and inheritance — clear examples (AAA)", () => {
  it("uses abstract class with polymorphism", () => {
    // Arrange
    abstract class Animal {
      constructor(public name: string) {}
      abstract sound(): string;
      describe() {
        return `I am ${this.name} and I go ${this.sound()}`;
      }
    }

    class Cat extends Animal {
      sound() {
        return "meow";
      }
    }

    class Dog extends Animal {
      sound() {
        return "woof";
      }
    }

    const animals = [new Cat("Michi"), new Dog("Hoko")];

    // Action
    const phrases = animals.map((a) => a.describe());

    // Assert
    expect(phrases).toContain("I am Michi and I go meow");
    expect(phrases).toContain("I am Hoko and I go woof");
  });

  it("uses 'extends' to inherit behavior", () => {
    // Arrange
    class Base {
      protected log(m: string) {
        return `[Base] ${m}`;
      }
    }

    class Derived extends Base {
      greet() {
        return this.log("hello");
      }
    }

    // Action
    const instance = new Derived();
    const message = instance.greet();

    // Assert
    expect(message).toBe("[Base] hello");
  });
});
