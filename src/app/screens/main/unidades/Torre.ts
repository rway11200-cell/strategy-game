import { Container } from "pixi.js";
import { Proyectil } from "../../../utils/Proyectil";
import { CreadorUnidades } from "../CreadorUnidades";
import { Unidad, UnidadProps } from "./unidad";

export class Torre extends Unidad {
  constructor(
    contenedorPrincipal: Container,
    objetivos: Unidad[],
    creadorProyectiles: CreadorUnidades<Proyectil>,
  ) {
    const opciones: UnidadProps = {
      framesJson: "Torre1.json",
      opcionesDisparo: {
        rango: 150,
        cadenciaDisparo: 1,
        objetivos,
        creadorProyectiles,
      },
    };
    super(contenedorPrincipal, opciones);
    this.animateSrinte.anchor = { x: 0.5, y: 1 };
    this.zIndex = 10;
  }
}
