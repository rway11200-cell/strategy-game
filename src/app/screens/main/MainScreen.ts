import { FancyButton } from "@pixi/ui";
import { animate } from "motion";
import type { AnimationPlaybackControls } from "motion/react";
import { Container, PointData, Ticker } from "pixi.js";

import { engine } from "../../getEngine";
import { PausePopup } from "../../popups/PausePopup";
import { SettingsPopup } from "../../popups/SettingsPopup";

import { herramientaDesarrolloPintarPuntos } from "../../utils/herramietasDesarrollo";
import { Proyectil } from "../../utils/Proyectil";
import { CreadorUnidades } from "./CreadorUnidades";
import { BaseTorre } from "./unidades/baseTorre";
import { Enemigo } from "./unidades/enemigo";
import { Torre } from "./unidades/Torre";

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

/** The screen that holds the app */
export class MainScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["main"];

  public mainContainer: Container;
  private pauseButton: FancyButton;
  private settingsButton: FancyButton;

  private creadorEnemigos: CreadorUnidades<Enemigo>;
  private creadorTorres: CreadorUnidades<Torre>;
  private creadorProyectiles: CreadorUnidades<Proyectil>;

  private paused = false;

  constructor() {
    super();

    this.mainContainer = new Container();
    this.addChild(this.mainContainer);

    herramientaDesarrolloPintarPuntos(this.mainContainer, camino, "red", 15);

    this.creadorProyectiles = new CreadorUnidades<Proyectil>({
      contenedor: this.mainContainer,
      cantidadReservaInicial: 10,
      fabrica: () => {
        return new Proyectil(this.mainContainer, {
          opcionesSeguidorDeObjetivos: {
            forzarActivarSeguidorCamino: true,
            velocidad: 2,
          },
        });
      },
    });

    this.creadorEnemigos = new CreadorUnidades<Enemigo>({
      contenedor: this.mainContainer,
      cantidadReservaInicial: 10,
      fabrica: () => {
        return new Enemigo(this.mainContainer, {
          opcionesSeguidorDeObjetivos: { objetivos: camino, variacion: 10, velocidad: 0.5 },
          vida: 100,
        });
      },
    });

    this.creadorEnemigos.generarGrupoUnidadesActivas(30, 800);

    this.creadorTorres = new CreadorUnidades<Torre>({
      contenedor: this.mainContainer,
      cantidadReservaInicial: 10,
      fabrica: () => {
        return new Torre(this.mainContainer, {
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
      const baseTorre = new BaseTorre(this.mainContainer);
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

      this.mainContainer.addChild(baseTorre);
    });

    const buttonAnimations = {
      hover: {
        props: {
          scale: { x: 1.1, y: 1.1 },
        },
        duration: 100,
      },
      pressed: {
        props: {
          scale: { x: 0.9, y: 0.9 },
        },
        duration: 100,
      },
    };
    this.pauseButton = new FancyButton({
      defaultView: "icon-pause.png",
      anchor: 0.5,
      animations: buttonAnimations,
    });
    this.pauseButton.onPress.connect(() => engine().navigation.presentPopup(PausePopup));
    this.addChild(this.pauseButton);

    this.settingsButton = new FancyButton({
      defaultView: "icon-settings.png",
      anchor: 0.5,

      animations: buttonAnimations,
    });
    this.settingsButton.onPress.connect(() => engine().navigation.presentPopup(SettingsPopup));
    this.addChild(this.settingsButton);
  }

  /** Prepare the screen just before showing */
  public prepare() {}

  /** Update the screen */
  public update(_time: Ticker) {
    // si el juego esta en pausa no actualiza nada
    if (this.paused) return;

    // actualiza todas las unidades hechas por un Creador de Unidades
    this.creadorEnemigos.update(_time);
    this.creadorTorres.update(_time);
    this.creadorProyectiles.update(_time);
  }

  /** Pause gameplay - automatically fired when a popup is presented */
  public async pause() {
    this.mainContainer.interactiveChildren = false;
    this.paused = true;
  }

  /** Resume gameplay */
  public async resume() {
    this.mainContainer.interactiveChildren = true;
    this.paused = false;
  }

  /** Fully reset */
  public reset() {}

  /** Resize the screen, fired whenever window size changes */
  public resize(width: number, height: number) {
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    this.mainContainer.x = centerX;
    this.mainContainer.y = centerY;
    this.pauseButton.x = 30;
    this.pauseButton.y = 30;
    this.settingsButton.x = width - 30;
    this.settingsButton.y = 30;
  }

  /** Show screen with animations */
  public async show(): Promise<void> {
    engine().audio.bgm.play("main/sounds/bgm-main.mp3", { volume: 0.6 });

    const elementsToAnimate = [this.pauseButton, this.settingsButton];

    let finalPromise!: AnimationPlaybackControls;
    for (const element of elementsToAnimate) {
      element.alpha = 0;
      finalPromise = animate(
        element,
        { alpha: 1 },
        { duration: 0.3, delay: 0.75, ease: "backOut" },
      );
    }

    await finalPromise;
  }

  /** Hide screen with animations */
  public async hide() {}

  /** Auto pause the app when window go out of focus */
  public blur() {
    if (!engine().navigation.currentPopup) {
      engine().navigation.presentPopup(PausePopup);
    }
  }
}
