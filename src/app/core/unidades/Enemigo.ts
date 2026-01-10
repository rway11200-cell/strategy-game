import { Container } from "pixi.js";
import { Unidad, UnidadProps } from "./Unidad";

export class Enemigo extends Unidad {
  constructor(contenedorPrincipal: Container, opciones?: UnidadProps) {
    if (opciones) {
      opciones.framesJson = {
        idle: "esqueleton-idle.json",
        run: "esqueleton-run.json",
        dead: "esqueleton-dead.json",
      };
    }
    super(contenedorPrincipal, opciones);
  }
}
