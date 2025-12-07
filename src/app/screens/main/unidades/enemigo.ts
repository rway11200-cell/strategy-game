import { Container } from "pixi.js";
import { Unidad, UnidadProps } from "./unidad";

export class Enemigo extends Unidad {
  constructor(contenedorPrincipal: Container, opciones?: UnidadProps) {
    if (opciones) {
      opciones.framesJson = "goblin scout - silhouette all animations-run.json";
    }
    super(contenedorPrincipal, opciones);
  }
}
