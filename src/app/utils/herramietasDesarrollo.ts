import { Color, Container, Graphics, PointData } from "pixi.js";

export function herramientaDesarrolloPintarPuntos(
  container: Container,
  puntos: PointData[],
  color: "red" | "blue" | "green",
  tamañoPX: number,
) {
  puntos.forEach((punto) => {
    container.addChild(
      new Graphics()
        .rect(punto.x - tamañoPX / 2, punto.y - tamañoPX / 2, tamañoPX, tamañoPX)
        .stroke({ color: new Color(color) }),
    );
  });
}
