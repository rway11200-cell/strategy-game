import { describe, expect, it } from "vitest";

describe("⏳ Promesas y async/await (AAA)", () => {
  it("crea una promesa básica", async () => {
    // Organizar
    const obtenerMensaje = () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("Hola desde la promesa"), 50);
      });

    // Acción
    const resultado = await obtenerMensaje();

    // Esperado
    expect(resultado).toBe("Hola desde la promesa");
  });

  it("maneja error con reject", async () => {
    // Organizar
    const puedeFallar = (ok: boolean) =>
      new Promise<string>((resolve, reject) => {
        if (ok) resolve("OK");
        else reject("Error");
      });

    // Acción
    let mensaje = "";
    try {
      await puedeFallar(false);
    } catch (e) {
      mensaje = String(e);
    }

    // Esperado
    expect(mensaje).toBe("Error");
  });

  it("usa async/await con try/catch", async () => {
    // Organizar
    const dividir = async (a: number, b: number) => {
      if (b === 0) throw new Error("División por cero");
      return a / b;
    };

    // Acción
    const exito = await dividir(10, 2);
    let errorMensaje = "";
    try {
      await dividir(5, 0);
    } catch (e) {
      errorMensaje = (e as Error).message;
    }

    // Esperado
    expect(exito).toBe(5);
    expect(errorMensaje).toBe("División por cero");
  });

  it("usa Promise.all para ejecutar en paralelo", async () => {
    // Organizar
    const tareas = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)];

    // Acción
    const resultados = await Promise.all(tareas);

    // Esperado
    expect(resultados).toEqual([1, 2, 3]);
  });
});
