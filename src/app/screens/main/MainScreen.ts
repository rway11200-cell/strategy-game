import { FancyButton } from "@pixi/ui";
import { animate } from "motion";
import type { AnimationPlaybackControls } from "motion/react";
import type { PointData, Ticker } from "pixi.js";
import { Color, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";

import { engine } from "../../getEngine";
import { PausePopup } from "../../popups/PausePopup";
import { SettingsPopup } from "../../popups/SettingsPopup";

import { herramientaDesarrolloPintarPuntos } from "../../utils/herramietasDesarrollo";
import { MoverUnTickHaciaTarget } from "../../utils/movimiento";
import { Proyectil } from "../../utils/Proyectil";
import { CreadorUnidades } from "./CreadorUnidades";
import { BaseTorre } from "./unidades/baseTorre";
import { Enemigo } from "./unidades/enemigo";
import { Torre } from "./unidades/Torre";
import { Unidad } from "./unidades/unidad";

interface ManejadorDeTorre {
  ubicacion: PointData;
  construido: boolean;
}

/** The screen that holds the app */
export class MainScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["main"];

  public mainContainer: Container;
  private pauseButton: FancyButton;
  private settingsButton: FancyButton;

  private creadorEnemigos: CreadorUnidades;
  private paused = false;
  public proyectiles: Proyectil[];
  public unidades!: Unidad[];

  constructor() {
    super();

    this.proyectiles = [];

    this.mainContainer = new Container();
    this.addChild(this.mainContainer);

    const graphics = new Graphics();
    graphics.circle(0, 0, 30);
    graphics.stroke({ width: 4, color: "purple" });
    graphics.fill("purple");

    this.mainContainer.addChild(graphics);

    const star = new Graphics();
    star.star(0, 0, 5, 15);
    star.fill("white");
    const containerStar = new Container();
    containerStar.position.set(60, 0);
    containerStar.addChild(star);

    this.mainContainer.addChild(containerStar);

    const ticker = new Ticker();
    ticker.add(() => {
      if (graphics.containsPoint(containerStar.position)) {
        star.visible = true;
      } else {
        star.visible = false;
      }
      console.log(star._position);
      star.moveTo(60, 0);
    });
    ticker.start();

    const manejadorDeTorres: ManejadorDeTorre[] = [
      { ubicacion: { x: 1, y: -100 }, construido: false },
      { ubicacion: { x: 100, y: 50 }, construido: false },
      { ubicacion: { x: -100, y: 50 }, construido: false },
      { ubicacion: { x: -200, y: -100 }, construido: false },
      { ubicacion: { x: 200, y: -100 }, construido: false },
      { ubicacion: { x: 1, y: -100 }, construido: false },
      { ubicacion: { x: 100, y: 50 }, construido: false },
      { ubicacion: { x: -100, y: 50 }, construido: false },
      { ubicacion: { x: -200, y: -100 }, construido: false },
      { ubicacion: { x: 200, y: -100 }, construido: false },
    ];

    manejadorDeTorres.forEach((manejador) => {
      const newSprite = new BaseTorre();
      newSprite.position = manejador.ubicacion;
      newSprite.eventMode = "static";
      newSprite.generate();

      newSprite.onclick = () => {
        if (manejador.construido === true) {
          console.log("aqui ya hay una torre");
          return;
        }

        this.mainContainer.addChild(new Torre("Torre1.json", manejador.ubicacion));
        manejador.construido = true;
        engine().audio.sfx.play("main/sounds/sfx-hover.wav", { volume: 0.6 });

        const proyectil = new Proyectil({ origen: newSprite.position });
        this.proyectiles.push(proyectil);
        this.mainContainer.addChild(proyectil.sprite);
        engine().audio.sfx.play("main/sounds/sfx-hover.wav", { volume: 0.6 });

        this.proyectil = new Sprite({
          texture: Texture.WHITE,
          position: { x: 1, y: -100 },
          tint: new Color("yellow"),
          width: 20,
          height: 20,
        });
        this.mainContainer.addChild(this.proyectil);
      };

      this.mainContainer.addChild(newSprite);
    });

    //TODO: el camino seguramente será por nivel esto deberia ser el primer elemento de un array de "Nivel" o algo asi
    const camino = [
      { x: -600, y: 300 },
      { x: -300, y: 200 },
      { x: -200, y: 100 },
      { x: -100, y: -100 },
      { x: 200, y: 0 },
    ];
    herramientaDesarrolloPintarPuntos(this.mainContainer, camino, "red", 15);

    this.creadorEnemigos = new CreadorUnidades({
      contenedor: this.mainContainer,
      cantidad: 10,
      retrasoAparicionMS: 200,
      unidad: Enemigo,
      camino,
    });

    setTimeout(() => {
      this.unidades = this.creadorEnemigos.generarGrupoUnidades();
      this.unidades = this.creadorEnemigos.generarGrupoUnidades();
    }, 3000);

    // Area de colision
    let colisionX = camino[4].x;
    let colisionY = camino[4].y;
    let colisionSize = 40;

    const rect = new Rectangle(
      colisionX - colisionSize / 2,
      colisionY - colisionSize / 2,
      colisionSize,
      colisionSize,
    );

    herramientaDesarrolloPintarPuntos(
      this.mainContainer,
      [{ x: colisionX, y: colisionY }],
      "green",
      colisionSize,
    );

    const ticker = new Ticker();

    ticker.add(() => {
      if (!this.unidades) return;

      this.unidades.forEach((unidad) => {
        const estaColisionando = rect.contains(unidad.x, unidad.y);
        if (estaColisionando) {
          unidad.destruye();
        }
      });
    });
    // Start the ticker
    ticker.start();

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
    if (this.paused) return;
    this.creadorEnemigos.update(_time);
    const unidad1: Unidad | undefined = this.unidades ? this.unidades[9] : undefined;
    this.proyectiles.forEach((proyectil) => {
      if (unidad1) {
        const llegoADestino = MoverUnTickHaciaTarget(
          1,
          proyectil.sprite,
          unidad1.position,
          _time,
          10,
        );
        if (llegoADestino) {
          proyectil.destruye();
        }
      }
    });
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
