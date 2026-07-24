import { FancyButton } from "@pixi/ui";
import { animate } from "motion";
import type { AnimationPlaybackControls } from "motion/react";
import { Container, type FederatedPointerEvent, Rectangle, Ticker } from "pixi.js";

import { engine } from "../../getEngine";
import { PausePopup } from "../../popups/PausePopup";
import { SettingsPopup } from "../../popups/SettingsPopup";

import { PauseResumeOption } from "../../../engine/navigation/navigation";
import { SandboxManager } from "../../core/SandboxManager";
import { SelectedUnitUI } from "../../ui/game/SelectedUnitUI";
import { CommandUI, type CommandAction } from "../../ui/game/CommandUI";
import { Unit } from "../../core/unidades/Unit";
import { worldToGrid } from "../../../grid/GridConfig";

export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1080;

export class MainScreen extends Container {
  public static assetBundles = ["main"];

  private mainContainer: Container;
  public worldContainer: Container;
  private cameraContainer: Container;
  private pauseButton: FancyButton;
  private settingsButton: FancyButton;
  private selectedUnitUI: SelectedUnitUI;
  private commandUI: CommandUI;
  private selectedUnit?: Unit;
  private pendingCommand: CommandAction | null = null;
  private patrolFirstPoint?: { col: number; row: number };
  private cameraX = 0;
  private cameraY = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;

  private sandboxManager!: SandboxManager;

  private paused = false;

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

    this.cameraContainer.hitArea = new Rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT);

    this.cameraContainer.on("pointerdown", (e) => {
      if (e.button === 2) {
        this.handleGridClick(e);
        return;
      }
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
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      this.setCamera(this.cameraStartX - dx, this.cameraStartY - dy);
    });

    const stopDrag = () => {
      this.isDragging = false;
    };

    this.cameraContainer.on("pointerup", (e) => {
      if (this.isDragging && Math.abs(e.global.x - this.dragStartX) < 4 && Math.abs(e.global.y - this.dragStartY) < 4) {
        this.handleGridClick(e);
      }
      stopDrag();
    });
    this.cameraContainer.on("pointerupoutside", stopDrag);
    this.cameraContainer.on("pointercancel", stopDrag);

    this.cameraContainer.on("rightclick", (e) => {
      e.preventDefault();
      this.handleGridClick(e);
    });

    this.sandboxManager = new SandboxManager(this.worldContainer);

    this.selectedUnitUI = new SelectedUnitUI();
    this.addChild(this.selectedUnitUI);

    this.commandUI = new CommandUI({
      onCommand: (action) => this.handleCommandAction(action),
    });
    this.addChild(this.commandUI);

    document.addEventListener("keydown", this.handleKeyDown);

    const canvas = engine().canvas;
    if (canvas) {
      canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    const buttonAnimations = {
      hover: {
        props: { scale: { x: 1.1, y: 1.1 } },
        duration: 100,
      },
      pressed: {
        props: { scale: { x: 0.9, y: 0.9 } },
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

  public async prepare() {}

  public update(_time: Ticker) {
    if (this.paused) return;

    this.sandboxManager.update(_time);
    const activeUnits = this.sandboxManager.getActiveUnits();
    activeUnits.forEach((unit) => unit.setSelectionHandler(this.selectUnit));
    if (this.selectedUnit && !activeUnits.includes(this.selectedUnit)) this.selectUnit();
    this.selectedUnitUI.showUnit(this.selectedUnit);
    this.sandboxManager.updateMarkers(this.selectedUnit);
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
    this.selectedUnitUI.position.set(20, height - 134);
    this.commandUI.position.set(20, height - 134 - 36);
  }

  private selectUnit = (unit?: Unit): void => {
    if (this.pendingCommand === "attack" && unit && this.selectedUnit && this.selectedUnit.isHostileTo(unit)) {
      console.log("[ATTACK] issuing attack on", unit.getId(), "from", this.selectedUnit.getId());
      this.sandboxManager.issueAttack(this.selectedUnit, unit);
      this.pendingCommand = null;
      this.commandUI.setHighlight(null);
      return;
    }
    console.log("[SELECT] unit:", unit?.getId(), "team:", unit?.team, "pendingCommand:", this.pendingCommand, "selectedUnit:", this.selectedUnit?.getId());
    if (this.selectedUnit === unit) return;
    this.selectedUnit?.setSelected(false);
    this.selectedUnit = unit;
    this.selectedUnit?.setSelected(true);
    this.selectedUnitUI.showUnit(unit);
    this.commandUI.visible = Boolean(unit && unit.team === "player");
    this.pendingCommand = null;
    this.patrolFirstPoint = undefined;
    this.commandUI.setHighlight(null);
  };

  private handleCommandAction(action: CommandAction): void {
    if (!this.selectedUnit) return;
    if (action === "stop") {
      this.sandboxManager.issueStop(this.selectedUnit);
      this.pendingCommand = null;
      this.commandUI.setHighlight(null);
      return;
    }
    if (action === "hold") {
      this.sandboxManager.issueHold(this.selectedUnit);
      this.pendingCommand = null;
      this.commandUI.setHighlight(null);
      return;
    }
    if (this.pendingCommand === action) {
      this.pendingCommand = null;
      this.commandUI.setHighlight(null);
      return;
    }
    this.pendingCommand = action;
    this.commandUI.setHighlight(action);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.selectedUnit || this.selectedUnit.team !== "player") return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key.toUpperCase();
    if (key === "M") this.handleCommandAction("move");
    else if (key === "S") this.handleCommandAction("stop");
    else if (key === "H") this.handleCommandAction("hold");
    else if (key === "A") this.handleCommandAction("attack");
    else if (key === "P") this.handleCommandAction("patrol");
    else if (key === "ESCAPE") { this.pendingCommand = null; this.commandUI.setHighlight(null); }
  };

  private handleGridClick(e: FederatedPointerEvent): void {
    if (!this.selectedUnit || !this.pendingCommand) return;

    const local = this.worldContainer.toLocal(e.global);
    const cell = worldToGrid(local.x, local.y, this.sandboxManager.gridConfig);
    if (cell.x < 0 || cell.y < 0 || cell.x >= this.sandboxManager.gridConfig.gridWidth || cell.y >= this.sandboxManager.gridConfig.gridHeight) return;
    const coord = { col: cell.x, row: cell.y };

    if (this.pendingCommand === "move") {
      this.sandboxManager.issueMove(this.selectedUnit, coord);
    } else if (this.pendingCommand === "patrol") {
      if (!this.patrolFirstPoint) {
        this.patrolFirstPoint = coord;
        return;
      }
      this.sandboxManager.issuePatrol(this.selectedUnit, [this.patrolFirstPoint, coord]);
      this.patrolFirstPoint = undefined;
    }

    this.pendingCommand = null;
    this.commandUI.setHighlight(null);
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
