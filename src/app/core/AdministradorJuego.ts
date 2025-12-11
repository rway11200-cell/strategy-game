import { Container, PointData, Ticker } from "pixi.js";
import { engine } from "../getEngine";
import { herramientaDesarrolloPintarPuntos } from "../utils/herramietasDesarrollo";
import { CreadorUnidades } from "./CreadorUnidades";
import { BaseTorre } from "./unidades/BaseTorre";
import { Enemigo } from "./unidades/Enemigo";
import { Proyectil } from "./unidades/Proyectil";
import { Torre } from "./unidades/Torre";
import { Unidad } from "./unidades/Unidad";

interface ManejadorDeTorre {
  ubicacion: PointData;
  construido: boolean;
}

//TODO: el camino seguramente será por nivel esto deberia ser el primer elemento de un array de "Nivel" o algo asi
const camino = [
  { x: -300, y: 200 },
  { x: -200, y: 100 },
  { x: -100, y: -100 },
  { x: 200, y: 0 },
];

const manejadorDeTorres: ManejadorDeTorre[] = [
  { ubicacion: { x: 1, y: -100 }, construido: false },
  { ubicacion: { x: 100, y: 50 }, construido: false },
  { ubicacion: { x: -100, y: 50 }, construido: false },
  { ubicacion: { x: -200, y: -100 }, construido: false },
  { ubicacion: { x: 200, y: -100 }, construido: false },
];

export class AdministradorJuego {
  private creadorEnemigos: CreadorUnidades<Enemigo>;
  private creadorTorres: CreadorUnidades<Torre>;
  private creadorProyectiles: CreadorUnidades<Proyectil>;
  private contenedorJuegoPrincipal: Container;

  constructor(mainContainerScreen: Container) {
    this.contenedorJuegoPrincipal = mainContainerScreen;

    herramientaDesarrolloPintarPuntos(this.contenedorJuegoPrincipal, camino, "red", 15);

    this.creadorProyectiles = new CreadorUnidades<Proyectil>({
      contenedor: this.contenedorJuegoPrincipal,
      cantidadReservaInicial: 10,
      fabrica: () => {
        return new Proyectil(this.contenedorJuegoPrincipal, {
          opcionesSeguidorDeObjetivos: {
            forzarActivarSeguidorCamino: true,
            velocidad: 2,
          },
        });
      },
    });

    this.creadorEnemigos = new CreadorUnidades<Enemigo>({
      contenedor: this.contenedorJuegoPrincipal,
      cantidadReservaInicial: 10,
      fabrica: () => {
        const nuevoEnemigo = new Enemigo(this.contenedorJuegoPrincipal, {
          opcionesSeguidorDeObjetivos: { objetivos: camino, variacion: 10, velocidad: 0.3 },
          vida: 100,
        });
        nuevoEnemigo.onDestruye = () => {
          this.removerseComoObjetivoDeLosProyectiles(nuevoEnemigo);
        };
        return nuevoEnemigo;
      },
    });

    this.creadorEnemigos.generarGrupoUnidadesActivas(30, 800);

    this.creadorTorres = new CreadorUnidades<Torre>({
      contenedor: this.contenedorJuegoPrincipal,
      cantidadReservaInicial: 10,
      fabrica: () => {
        return new Torre(this.contenedorJuegoPrincipal, {
          opcionesDisparo: {
            rango: 150,
            daño: 20,
            cadenciaDisparo: 0.5,
            creadorProyectiles: this.creadorProyectiles,
            objetivos: this.creadorEnemigos.obtenerUnidades(),
          },
        });
      },
    });

    manejadorDeTorres.forEach((manejador) => {
      const baseTorre = new BaseTorre(this.contenedorJuegoPrincipal);
      baseTorre.position = manejador.ubicacion;
      baseTorre.generate();

      baseTorre.onclick = () => {
        if (manejador.construido === true) {
          console.log("aqui ya hay una torre");
          return;
        }

        const torre = this.creadorTorres.obtener(true);
        torre.position = manejador.ubicacion;
        torre.generate();

        manejador.construido = true;
        engine().audio.sfx.play("main/sounds/sfx-hover.wav", { volume: 0.6 });
      };

      this.contenedorJuegoPrincipal.addChild(baseTorre);
    });
  }

  private removerseComoObjetivoDeLosProyectiles = (unidad: Unidad) => {
    const proyectilesActivados = this.creadorProyectiles.obtenerUnidades();
    proyectilesActivados.forEach((proyectil) => {
      if (proyectil.seguidorDeObjetivos?.obtenerUnidadFinal() === unidad) {
        // TODO quizas deberia llegar al ultim lugar donde estaba el objetivo
        proyectil.destruye();
      }
    });
  };

  public update(_time: Ticker) {
    // actualiza todas las unidades hechas por cada Creador de Unidades
    this.creadorEnemigos.update(_time);
    this.creadorTorres.update(_time);
    this.creadorProyectiles.update(_time);
  }
}
