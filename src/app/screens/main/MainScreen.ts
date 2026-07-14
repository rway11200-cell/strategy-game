import { FancyButton } from "@pixi/ui";
import { animate } from "motion";
import type { AnimationPlaybackControls } from "motion/react";
import { Assets, Container, Rectangle, Sprite, Ticker } from "pixi.js";

import { engine } from "../../getEngine";
import { PausePopup } from "../../popups/PausePopup";
import { SettingsPopup } from "../../popups/SettingsPopup";

import { EditableMaps } from "../../../core/maps/EditableMaps";
import { PauseResumeOption } from "../../../engine/navigation/navigation";
import { GameManager } from "../../core/GameManager";
import { CoinsUI } from "../../ui/game/CoinsUI";
import { NotificationsUI } from "../../ui/game/NotificationsUI";
import { createGridConfig } from "../../../grid/GridConfig";
import { GridDebugOverlay } from "../../../grid/GridDebugOverlay";

export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1080;

export class MainScreen extends Container {
  public static assetBundles = ["main"];

  private mainContainer: Container;
  public worldContainer: Container;
  private cameraContainer: Container;
  private backgroundSprite?: Sprite;
  private pauseButton: FancyButton;
  private settingsButton: FancyButton;
  private coinsContainer: CoinsUI;
  private cameraX = 0;
  private cameraY = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;

  private gameManager!: GameManager;
  private editMapButton: FancyButton;

  private paused = false;

  public editableMaps: EditableMaps;

  private notifications: NotificationsUI;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  private cameraStartX = 0;
  private cameraStartY = 0;

  constructor() {
    super();

    this.cameraContainer = new Container();
    this.cameraContainer.eventMode = "static";
    this.addChildAt(this.cameraContainer, 0);

    this.mainContainer = new Container();
    this.addChild(this.mainContainer);

    this.worldContainer = new Container();
    this.cameraContainer.addChild(this.worldContainer);

    const assignBackground = (backgroundImage: string) => {
      const texture = Assets.get(backgroundImage);
      this.backgroundSprite = new Sprite(texture);
      this.backgroundSprite.eventMode = "none";
      this.worldContainer.addChild(this.backgroundSprite);
    };

    this.cameraContainer.hitArea = new Rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT);

    this.cameraContainer.on("pointerdown", (e) => {
      this.isDragging = true;

      this.dragStartX = e.global.x;
      this.dragStartY = e.global.y;

      this.cameraStartX = this.cameraX;
      this.cameraStartY = this.cameraY;
    });

    this.cameraContainer.on("pointermove", (e) => {
      if (!this.isDragging) return;

      const dx = e.global.x - this.dragStartX;
      const dy = e.global.y - this.dragStartY;

      this.setCamera(this.cameraStartX - dx, this.cameraStartY - dy);
    });

    const stopDrag = () => {
      this.isDragging = false;
    };

    this.cameraContainer.on("pointerup", stopDrag);
    this.cameraContainer.on("pointerupoutside", stopDrag);
    this.cameraContainer.on("pointercancel", stopDrag);

    this.editableMaps = new EditableMaps(this);

    this.coinsContainer = new CoinsUI();
    this.addChild(this.coinsContainer);

    this.notifications = new NotificationsUI(this.mainContainer);

    this.gameManager = new GameManager(
      this.worldContainer,
      this.coinsContainer,
      this.notifications,
      assignBackground,
    );

    const gridConfig = createGridConfig();
    const gridOverlay = new GridDebugOverlay(gridConfig, true);
    this.worldContainer.addChild(gridOverlay.getContainer());
    gridOverlay.toggle();
    gridOverlay.render();

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

  public async prepare() {}

  public update(_time: Ticker) {
    if (this.paused) return;

    if (!this.gameManager) return;

    this.gameManager.update(_time);
  }

  public async pause({ ignoreInteractiveChildren = false }: PauseResumeOption = {}) {
    if (!ignoreInteractiveChildren) {
      this.mainContainer.interactiveChildren = false;
    }
    this.paused = true;
  }

  public async resume({ ignoreInteractiveChildren = false }: PauseResumeOption = {}) {
    if (!ignoreInteractiveChildren) {
      this.mainContainer.interactiveChildren = true;
    }
    this.paused = false;
  }

  public reset() {}

  public resize(width: number, height: number) {
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    this.viewportWidth = width;
    this.viewportHeight = height;

    this.mainContainer.x = centerX;
    this.mainContainer.y = centerY;

    const startX = (MAP_WIDTH - width) * 0.5;
    const startY = (MAP_HEIGHT - height) * 0.5;

    this.setCamera(startX, startY);

    this.pauseButton.x = 30;
    this.pauseButton.y = 30;
    this.settingsButton.x = width - 30;
    this.settingsButton.y = 30;
    this.coinsContainer.x = width - this.coinsContainer.width - 50;
    this.coinsContainer.y = 60;
    this.editMapButton.x = width - 30;
    this.editMapButton.y = 90;

    this.notifications.resize(centerX, centerY);
  }

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

  private setCamera(x: number, y: number) {
    this.cameraX = Math.max(0, Math.min(x, MAP_WIDTH - this.viewportWidth));

    this.cameraY = Math.max(0, Math.min(y, MAP_HEIGHT - this.viewportHeight));

    this.cameraContainer.x = -this.cameraX;
    this.cameraContainer.y = -this.cameraY;
  }

  public async hide() {}

  public blur() {
    if (!engine().navigation.currentPopup) {
      engine().navigation.presentPopup(PausePopup);
    }
  }
}
