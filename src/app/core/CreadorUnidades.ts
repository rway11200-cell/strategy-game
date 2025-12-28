import { Container, Ticker } from "pixi.js";
import { Unidad } from "./unidades/Unidad";

interface CreadorUnidadesProps<T extends Unidad> {
  contenedor: Container;
  cantidadReservaInicial: number;
  fabrica: () => T;
}

/**
 * Clase creadora de unidades, capaz de crear hordas.
 *
 * @description Genera instancias de unidades y controla su aparición secuencial.
 * @param {CreadorUnidadesProps} props - Propiedades del creador.
 * @param {Container} props.contenedor - Contenedor donde se agregan las unidades.
 * @param {func ()=> T} props.fabrica - Creador de la unidad
 * @param {number} props.cantidadReservaInicial - Número total de unidades iniciales.
 */
export class CreadorUnidades<T extends Unidad> {
  private unidades: T[];
  private contenedor: Container;
  fabrica: () => T;

  constructor({ contenedor, fabrica, cantidadReservaInicial }: CreadorUnidadesProps<T>) {
    this.contenedor = contenedor;
    this.fabrica = fabrica;

    // Crea las unidades invisibles las ingresa al contendor y ademas las conserva en una variable interna
    this.unidades = [];
    for (let i = 0; i < cantidadReservaInicial; i++) {
      const nuevaUnidad = this.crearYRegistrarUnidad();
      this.unidades.push(nuevaUnidad);
      this.contenedor.addChild(nuevaUnidad);
    }
  }

  private crearYRegistrarUnidad(): T {
    const unidad = this.fabrica();
    unidad.activo = false;
    unidad.visible = false;

    this.contenedor.addChild(unidad);
    return unidad;
  }

  // Obtiene unidad libre/desactivada, si no crea una y la añade al pull
  public obtener(activada: boolean = false): T {
    const libre = this.unidades.find((i) => !i.activo);
    if (libre) {
      if (activada) libre.generate();
      return libre;
    }

    const nuevo = this.crearYRegistrarUnidad();
    this.unidades.push(nuevo);
    if (activada) nuevo.generate();
    return nuevo;
  }

  // Obtiene todas las unidades esten activas o no
  public obtenerUnidades(activada: boolean = false): T[] {
    if (activada) {
      return this.unidades.filter((unidad) => unidad.activo);
    }

    return this.unidades;
  }

  public aplicaATodasLasUnidades(actionAAplicar: (t: T) => void) {
    const unidades = this.obtenerUnidades();
    unidades.forEach((unidad) => actionAAplicar(unidad));
  }
  public update(_time: Ticker) {
    this.unidades.forEach((unidad) => {
      if (unidad.activo) {
        unidad.update(_time);
      }
    });
  }
}
