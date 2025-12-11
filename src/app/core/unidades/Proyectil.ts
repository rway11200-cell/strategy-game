import { Container } from "pixi.js";
import { Unidad, UnidadProps } from "./Unidad";

export class Proyectil extends Unidad {
  constructor(contenedorPrincipal: Container, opciones: UnidadProps) {
    opciones.framesJson = "Torre1.json";
    super(contenedorPrincipal, opciones);
    this.scale.set(0.1, 0.1);
    this.zIndex = 20;
  }
}
