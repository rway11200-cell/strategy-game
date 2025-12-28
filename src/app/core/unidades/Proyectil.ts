import { Container } from "pixi.js";
import { Unidad, UnidadProps } from "./Unidad";

export class Proyectil extends Unidad {
  constructor(contenedorPrincipal: Container) {
    const opciones: UnidadProps = {
      framesJson: { idle: "Torre1.json" },
      opcionesSeguidorDeObjetivos: {
        forzarActivarSeguidorCamino: true,
        velocidad: 2,
      },
    };
    super(contenedorPrincipal, opciones);
    this.scale.set(0.1, 0.1);
    this.zIndex = 20;
  }
}
