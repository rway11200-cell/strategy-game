import { Container } from "pixi.js";
import { Unidad, UnidadProps } from "./Unidad";

export class Enemigo extends Unidad {
  constructor(contenedorPrincipal: Container, opciones?: UnidadProps) {
    if (opciones) {
      opciones.framesJson = {
        idle: "goblin scout - silhouette all animations-idle.json",
        run: "goblin scout - silhouette all animations-run.json",
        dead: "goblin scout - silhouette all animations-death 1.json",
      };
    }
    super(contenedorPrincipal, opciones);
  }
}
