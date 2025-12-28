import { Container, Ticker } from "pixi.js";
import { MonedasUI } from "../ui/game/MonedasUI";
import { NotificacionesUI } from "../ui/game/NotificacionesUI";
import { herramientaDesarrolloPintarPuntos } from "../utils/herramietasDesarrollo";
import { CreadorUnidades } from "./CreadorUnidades";
import { ContextoNivel } from "./niveles/cargador/ContextoNivel";
import { ConvertidorJsonANivel } from "./niveles/cargador/ConvertidorJsonANivel";
import { ManejadorEventosNivel } from "./niveles/cargador/ManejadorEventosNivel";
import { LevelJSON } from "./niveles/cargador/SchemaNivel";
import { BaseTorre } from "./unidades/BaseTorre";
import { Enemigo } from "./unidades/Enemigo";
import { Proyectil } from "./unidades/Proyectil";
import { Torre } from "./unidades/Torre";
import { Unidad } from "./unidades/Unidad";

export class AdministradorJuego {
  private contenedorJuegoPrincipal: Container;
  private manejadorEventos: ManejadorEventosNivel;

  private contextoJuego: ContextoNivel;

  private monedasUI: MonedasUI;

  constructor(
    levelJSON: LevelJSON,
    mainContainerScreen: Container,
    monedasUI: MonedasUI,
    notificaciones: NotificacionesUI,
  ) {
    this.contenedorJuegoPrincipal = mainContainerScreen;
    this.monedasUI = monedasUI;

    const estrucuturaNivel = new ConvertidorJsonANivel(levelJSON);

    this.contextoJuego = this.creacionContextoJuego(estrucuturaNivel, notificaciones);

    this.contextoJuego.paths.forEach((pathDef) => {
      herramientaDesarrolloPintarPuntos(this.contenedorJuegoPrincipal, pathDef.points, "red", 15);
    });

    this.manejadorEventos = new ManejadorEventosNivel(estrucuturaNivel);
  }

  private creacionContextoJuego(
    estrucutraNivel: ConvertidorJsonANivel,
    notificaciones: NotificacionesUI,
  ): ContextoNivel {
    const creadorProyectiles = new CreadorUnidades<Proyectil>({
      contenedor: this.contenedorJuegoPrincipal,
      cantidadReservaInicial: 10,
      fabrica: () => {
        return new Proyectil(this.contenedorJuegoPrincipal);
      },
    });

    return {
      paths: estrucutraNivel.getCaminos(),
      entities: estrucutraNivel.getEntidades(),
      monedas: 100,
      mostrarMensaje: (mensaje) => {
        notificaciones.notifica(mensaje);
      },
      creadorProyectiles: creadorProyectiles,
      creadorEnemigos: new CreadorUnidades<Enemigo>({
        contenedor: this.contenedorJuegoPrincipal,
        cantidadReservaInicial: 10,
        fabrica: () => {
          const nuevoEnemigo = new Enemigo(this.contenedorJuegoPrincipal, {
            opcionesSeguidorDeObjetivos: { variacion: 30, velocidad: 0.6 },
            vida: 100,
          });
          nuevoEnemigo.onDestruye = () => {
            this.removerseComoObjetivoDeLosProyectiles(nuevoEnemigo);
            this.contextoJuego.monedas += 50;
          };
          return nuevoEnemigo;
        },
      }),
      creadorTorres: new CreadorUnidades<Torre>({
        contenedor: this.contenedorJuegoPrincipal,
        cantidadReservaInicial: 10,
        fabrica: () => {
          return new Torre(this.contenedorJuegoPrincipal, {
            opcionesDisparo: {
              rango: 150,
              daño: 20,
              cadenciaDisparo: 0.5,
              creadorProyectiles: creadorProyectiles,
            },
          });
        },
      }),
      creadorBaseTorres: new CreadorUnidades<BaseTorre>({
        contenedor: this.contenedorJuegoPrincipal,
        cantidadReservaInicial: 10,
        fabrica: () => {
          return new BaseTorre(this.contenedorJuegoPrincipal);
        },
      }),
    };
  }

  private removerseComoObjetivoDeLosProyectiles = (unidad: Unidad) => {
    const proyectilesActivados = this.contextoJuego.creadorProyectiles.obtenerUnidades();
    proyectilesActivados.forEach((proyectil) => {
      if (proyectil.seguidorDeObjetivos?.obtenerUnidadFinal() === unidad) {
        // TODO quizas deberia llegar al ultim lugar donde estaba el objetivo
        proyectil.destruye();
      }
    });
  };

  public update(_time: Ticker) {
    // actualiza todas las unidades hechas por cada Creador de Unidades

    this.manejadorEventos.update(_time, this.contextoJuego);

    this.monedasUI.asignarMonedas(this.contextoJuego.monedas);

    this.contextoJuego.creadorEnemigos.update(_time);
    this.contextoJuego.creadorTorres.update(_time);
    this.contextoJuego.creadorProyectiles.update(_time);
  }
}
