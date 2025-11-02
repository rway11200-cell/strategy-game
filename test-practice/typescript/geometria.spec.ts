import { describe, expect, it } from "vitest";
import { ingresoCircunferencia } from "./../../src/engine/utils/maths";

type Punto = {
  x: number;
  y: number;
};

describe("Geometria para coliciones", () => {
  describe("Circunferencia en la posision (6,-6) de radio 2", () => {
    it("El punto (8,-4) no esta dentro de la cirfenrecia", () => {
      // Arreglo
      const objeto: Punto = { x: 6, y: -6 };
      const target: Punto = { x: 8, y: -4 };
      const radio: number = 2;

      // Accion
      const resueltado = ingresoCircunferencia(objeto.x, objeto.y, target.x, target.y, radio);

      // Validar
      expect(resueltado).toBe(false);
    });

    it("El punto (6,-6) si esta dentro de la cirfenrecia", () => {
      // Arreglo
      const objeto: Punto = { x: 6, y: -6 };
      const target: Punto = { x: 6, y: -6 };
      const radio: number = 2;

      // Accion
      const resueltado = ingresoCircunferencia(objeto.x, objeto.y, target.x, target.y, radio);

      // Validar
      expect(resueltado).toBe(true);
    });

    it("El punto $point(7.5,-7.123131) si esta dentro de la cirfenrecia", () => {
      // Arreglo
      const objeto: Punto = { x: 6, y: -6 };
      const target: Punto = { x: 7.5, y: -7.123131 };
      const radio: number = 2;

      // Accion
      const resueltado = ingresoCircunferencia(objeto.x, objeto.y, target.x, target.y, radio);

      // Validar
      expect(resueltado).toBe(true);
    });

    it("El punto $point(7.9,-7.123131) si esta dentro de la cirfenrecia", () => {
      // Arreglo
      const objeto: Punto = { x: 6, y: -6 };
      const target: Punto = { x: 7.9, y: -7.123131 };
      const radio: number = 2;

      // Accion
      const resueltado = ingresoCircunferencia(objeto.x, objeto.y, target.x, target.y, radio);

      // Validar
      expect(resueltado).toBe(false);
    });
  });
});
