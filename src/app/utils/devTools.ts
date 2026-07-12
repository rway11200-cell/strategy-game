import { Color, Container, Graphics, PointData } from "pixi.js";

type DebugColor = "red" | "blue" | "green" | "yellow";

export function devToolDrawPoints(
  container: Container,
  point: PointData,
  color: DebugColor,
  sizePx: number,
  shape?: "circle" | "square",
): Graphics;

export function devToolDrawPoints(
  container: Container,
  points: PointData[],
  color: DebugColor,
  sizePx: number,
  shape?: "circle" | "square",
): Graphics[];

export function devToolDrawPoints(
  container: Container,
  points: PointData | PointData[],
  color: DebugColor,
  sizePx: number,
  shape: "circle" | "square" = "square",
): Graphics | Graphics[] {
  const list = Array.isArray(points) ? points : [points];

  const results: Graphics[] = [];

  list.forEach((point) => {
    let currentShape: Graphics;

    if (shape === "circle") {
      currentShape = new Graphics().circle(0, 0, sizePx).stroke({ color: new Color(color) });
    } else if (shape === "square") {
      currentShape = new Graphics()
        .rect(point.x - sizePx / 2, point.y - sizePx / 2, sizePx, sizePx)
        .stroke({ color: new Color(color) });
    } else {
      throw new Error("No shape defined");
    }

    container.addChild(currentShape);
    results.push(currentShape);
  });

  return Array.isArray(points) ? results : results[0];
}
