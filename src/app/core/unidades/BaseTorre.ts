import { Container } from "pixi.js";
import { Unidad } from "./Unidad";

export class BaseTorre extends Unidad {
  constructor(contenedorPrincipal: Container) {
    super(contenedorPrincipal, { framesJson: "suelo-torre.json" }); // Esto llama al constructor de Unidad
    this.eventMode = "static";
  }
}
