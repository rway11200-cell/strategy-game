import { describe, expect, it } from "vitest";

describe("Classes and inheritance — clear examples (AAA)", () => {
  it("basic classes", () => {
    // Arrange
    class Luis {
      public name: string;
      public age: number;

      constructor(name: string, age: number) {
        this.name = name;
        this.age = age;
      }
      greet(): string {
        return "I am " + this.name + " and I am " + this.age;

      }
    }

    class Panda {
      public name: string;
      public age: number;

      constructor(name: string, age: number) {
        this.name = name;
        this.age = age;
      }
      greet(): string {
        return "I am panda and I am 9"
      }
    }
    // Action

    const luis: Luis = new Luis("luis", 16);
    const panda: Panda = new Panda("panda", 9);

    // Assert
    expect(luis.name).toEqual("luis");
    expect(panda.name).toEqual("panda");

    expect(luis.greet()).toEqual("I am luis and I am 16");
    expect(panda.greet()).toEqual("I am panda and I am 9");

  });

    it("simple inheritance", () => {
    // Arrange
    class FamilyMember {
      public name: string;
      public age: number;

      constructor(name: string, age: number) {
        this.name = name;
        this.age = age;
      }
      greet(): string {
        return "I am " + this.name + " and I am " + this.age;

      }
    }

    class Luis extends FamilyMember {
      
      constructor(name: string, age: number){
        super(name, age);
      }
    }

    class Panda extends FamilyMember{

      constructor(name: string, age: number){
        super(name, age);
      }
    }
    // Action

    const luis: Luis = new Luis("luis", 16);
    const panda: Panda = new Panda("panda", 9);

    // Assert
    expect(luis.name).toEqual("luis");
    expect(panda.name).toEqual("panda");

    expect(luis.greet()).toEqual("I am luis and I am 16");
    expect(panda.greet()).toEqual("I am panda and I am 9");

  });
});
