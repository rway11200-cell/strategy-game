import { Unidad } from "./unidad";

export class BaseTorre extends Unidad {
  constructor() {
    super({ framesJson: "suelo-torre.json" }); // Esto llama al constructor de Unidad
  }
}
