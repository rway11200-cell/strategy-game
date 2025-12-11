import { Container } from "pixi.js";
import { Unidad, UnidadProps } from "./Unidad";

export class Torre extends Unidad {
  constructor(contenedorPrincipal: Container, opciones: UnidadProps) {
    opciones.framesJson = "Torre1.json";

    super(contenedorPrincipal, opciones);
    this.animateSrinte.anchor = { x: 0.5, y: 1 };
    this.zIndex = 10;
  }
}
