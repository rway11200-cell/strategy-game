import { Unidad, UnidadProps } from "./unidad";

export class Enemigo extends Unidad {
  constructor(opciones?: UnidadProps) {
    if (opciones) {
      opciones.framesJson = "goblin scout - silhouette all animations-run.json";
    }
    super(opciones);
  }
}
