import { Color, Container, Graphics, PointData } from "pixi.js";

type DebugColor = "red" | "blue" | "green" | "yellow";

export function herramientaDesarrolloPintarPuntos(
  container: Container,
  punto: PointData,
  color: DebugColor,
  tamañoPX: number,
  forma?: "circulo" | "cuadrado",
): Graphics;

export function herramientaDesarrolloPintarPuntos(
  container: Container,
  puntos: PointData[],
  color: DebugColor,
  tamañoPX: number,
  forma?: "circulo" | "cuadrado",
): Graphics[];

export function herramientaDesarrolloPintarPuntos(
  container: Container,
  puntos: PointData | PointData[],
  color: DebugColor,
  tamañoPX: number,
  forma: "circulo" | "cuadrado" = "cuadrado",
): Graphics | Graphics[] {
  const lista = Array.isArray(puntos) ? puntos : [puntos];

  const resultados: Graphics[] = [];

  lista.forEach((punto) => {
    let formaActual: Graphics;

    if (forma === "circulo") {
      formaActual = new Graphics().circle(0, 0, tamañoPX).stroke({ color: new Color(color) });
    } else if (forma === "cuadrado") {
      formaActual = new Graphics()
        .rect(punto.x - tamañoPX / 2, punto.y - tamañoPX / 2, tamañoPX, tamañoPX)
        .stroke({ color: new Color(color) });
    } else {
      throw new Error("no hay una forma definida");
    }

    container.addChild(formaActual);
    resultados.push(formaActual);
  });

  return Array.isArray(puntos) ? resultados : resultados[0];
}
