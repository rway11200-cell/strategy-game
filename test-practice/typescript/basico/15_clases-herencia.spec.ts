import { describe, expect, it } from "vitest";

describe("Clases y herencia — ejemplos claros (AAA)", () => {
  it("clases basicas", () => {
    // Organizar
    class Luis {
      public nombre: string;
      public edad: number;

      constructor(nombre: string, edad: number) {
        this.nombre = nombre;
        this.edad = edad;
      }
      saludo(): string {
        return "Soy " + this.nombre + " y tengo " + this.edad;

      }
    }

    class Panda {
      public nombre: string;
      public edad: number;

      constructor(nombre: string, edad: number) {
        this.nombre = nombre;
        this.edad = edad;
      }
      saludo(): string {
        return "Soy panda y tengo 9"
      }
    }
    // Acción

    const luis: Luis = new Luis("luis", 16);
    const panda: Panda = new Panda("panda", 9);

    // Esperado
    expect(luis.nombre).toEqual("luis");
    expect(panda.nombre).toEqual("panda");

    expect(luis.saludo()).toEqual("Soy luis y tengo 16");
    expect(panda.saludo()).toEqual("Soy panda y tengo 9");

  });

    it("herencia simple", () => {
    // Organizar
    class IntegranteFamiliar {
      public nombre: string;
      public edad: number;

      constructor(nombre: string, edad: number) {
        this.nombre = nombre;
        this.edad = edad;
      }
      saludo(): string {
        return "Soy " + this.nombre + " y tengo " + this.edad;

      }
    }

    class Luis extends IntegranteFamiliar {
      
      constructor(nombre: string, edad: number){
        super(nombre, edad);  //llama al constructor de "IntegranteFamiliar"
      }
    }

    class Panda extends IntegranteFamiliar{

      constructor(nombre: string, edad: number){
        super(nombre, edad);  //llama al constructor de "IntegranteFamiliar"
      }
    }
    // Acción

    const luis: Luis = new Luis("luis", 16);
    const panda: Panda = new Panda("panda", 9);

    // Esperado
    expect(luis.nombre).toEqual("luis");
    expect(panda.nombre).toEqual("panda");

    expect(luis.saludo()).toEqual("Soy luis y tengo 16");
    expect(panda.saludo()).toEqual("Soy panda y tengo 9");

  });
});
