import { Container } from "pixi.js";
import { Unidad } from "./unidad";

export class BaseTorre extends Unidad {
  constructor(contenedorPrincipal: Container) {
    super(contenedorPrincipal, { framesJson: "suelo-torre.json" }); // Esto llama al constructor de Unidad
    this.eventMode = "static";
  }
}
