import { FancyButton } from "@pixi/ui";
import { animate } from "motion";
import type { AnimationPlaybackControls } from "motion/react";
import { Container, Ticker } from "pixi.js";

import { engine } from "../../getEngine";
import { PausePopup } from "../../popups/PausePopup";
import { SettingsPopup } from "../../popups/SettingsPopup";

import { EditableMaps } from "../../../core/maps/EditableMaps";
import { PauseResumeOption } from "../../../engine/navigation/navigation";
import { AdministradorJuego } from "../../core/AdministradorJuego";
import { CargadorJsonNivel } from "../../core/niveles/cargador/CargadorJsonNivel";
import { MonedasUI } from "../../ui/game/MonedasUI";
import { NotificacionesUI } from "../../ui/game/NotificacionesUI";

/** The screen that holds the app */
export class MainScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["main"];

  public mainContainer: Container;
  private pauseButton: FancyButton;
  private settingsButton: FancyButton;
  private contenedorMonedas: MonedasUI;

  private administradorJuego!: AdministradorJuego;
  private editMapButton: FancyButton;

  private paused = false;

  public editableMaps: EditableMaps;

  private notificaciones: NotificacionesUI;

  constructor() {
    super();

    this.mainContainer = new Container();
    this.addChild(this.mainContainer);

    this.editableMaps = new EditableMaps(this);

    this.contenedorMonedas = new MonedasUI();
    this.addChild(this.contenedorMonedas);

    this.notificaciones = new NotificacionesUI(this.mainContainer);

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

    this.editMapButton = new FancyButton({
      defaultView: "icon-pause.png",
      anchor: 0.5,
      animations: buttonAnimations,
    });
    this.editMapButton.onPress.connect(() => {
      const isEditing = this.editableMaps.toggleEdit();
      this.editMapButton.defaultView = isEditing ? "icon-settings.png" : "icon-pause.png";
    });
    this.addChild(this.editMapButton);
  }

  /** Prepare the screen just before showing */
  public async prepare() {
    const loader = new CargadorJsonNivel();
    const level = await loader.load("/levels/level_01.json");

    this.administradorJuego = new AdministradorJuego(
      level,
      this.mainContainer,
      this.contenedorMonedas,
      this.notificaciones,
    );
  }

  /** Update the screen */
  public update(_time: Ticker) {
    // si el juego esta en pausa no actualiza nada
    if (this.paused) return;

    // si no hay administrador de juego mietras carga no hace nada tamposo
    if (!this.administradorJuego) return;

    // actualiza todas las unidades hechas por un Creador de Unidades
    this.administradorJuego.update(_time);
  }

  /** Pause gameplay - automatically fired when a popup is presented */
  public async pause({ ignoreInteractiveChildren = false }: PauseResumeOption = {}) {
    if (!ignoreInteractiveChildren) {
      this.mainContainer.interactiveChildren = false;
    }
    this.paused = true;
  }

  /** Resume gameplay */
  public async resume({ ignoreInteractiveChildren = false }: PauseResumeOption = {}) {
    if (!ignoreInteractiveChildren) {
      this.mainContainer.interactiveChildren = true;
    }
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
    this.contenedorMonedas.x = width - this.contenedorMonedas.width - 50;
    this.contenedorMonedas.y = 60;
    this.editMapButton.x = width - 30;
    this.editMapButton.y = 90;

    this.notificaciones.resize(centerX, centerY);
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
