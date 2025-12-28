import { Container } from "pixi.js";
import { Unidad } from "./Unidad";

export class BaseTorre extends Unidad {
  public construida: boolean = false;
  constructor(contenedorPrincipal: Container) {
    super(contenedorPrincipal, { framesJson: { idle: "suelo-torre.json" } }); // Esto llama al constructor de Unidad
    this.eventMode = "static";
  }
}
