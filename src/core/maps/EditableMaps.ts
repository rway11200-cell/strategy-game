import { Container, Cursor, EventMode, FederatedPointerEvent, Graphics } from "pixi.js";
import { AppScreen, PauseResumeOption } from "../../engine/navigation/navigation";

type OriginalProperties = {
  cursor?: Cursor | (string & {});
  eventMode?: EventMode;
};

type EditorHandlers = {
  originalProperties: OriginalProperties;
  overlay: Graphics;
  onOver: (e: FederatedPointerEvent) => void;
  onOut: (e: FederatedPointerEvent) => void;
  onDown: (e: FederatedPointerEvent) => void;
  onMove: (e: FederatedPointerEvent) => void;
  onUp: (e: FederatedPointerEvent) => void;
};

const pauseResumeOption: PauseResumeOption = { ignoreInteractiveChildren: true };

export class EditableMaps {
  private editMap = new WeakMap<Container, EditorHandlers>();
  private isEditing: boolean = false;
  private host: AppScreen;

  private dragTarget?: Container;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(host: AppScreen) {
    this.host = host;
  }

  private makeChildrenEditable() {
    if (!this.host.mainContainer) {
      return;
    }

    this.host.mainContainer.children.forEach((child) => {
      const state = this.editMap.get(child);
      if (state) return;

      const originalProperties: OriginalProperties = {
        eventMode: child.eventMode,
        cursor: child.cursor,
      };

      child.cursor = "pointer";
      child.eventMode = "dynamic";

      const bounds = child.getLocalBounds();
      const overlay = new Graphics()
        .rect(bounds.x, bounds.y, bounds.width, bounds.height)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.9 })
        .fill({ color: 0xffffff, alpha: 0.15 });

      overlay.visible = false;

      const onOver = () => {
        overlay.visible = true;
      };
      const onOut = () => {
        overlay.visible = false;
      };

      const isDraggingOther = () => this.dragTarget && this.dragTarget !== child;

      const onDown = (e: FederatedPointerEvent) => {
        if (isDraggingOther()) return;

        this.dragTarget = child;
        child.cursor = "grabbing";

        const parentPos = child.parent?.toLocal(e.global);
        if (parentPos) {
          this.dragOffsetX = child.x - parentPos.x;
          this.dragOffsetY = child.y - parentPos.y;
        }
      };

      const onMove = (e: FederatedPointerEvent) => {
        if (this.dragTarget !== child) return;

        const parent = child.parent;
        if (!parent) return;

        const pos = parent.toLocal(e.global);
        child.position.set(pos.x + this.dragOffsetX, pos.y + this.dragOffsetY);
      };

      const onUp = () => {
        if (this.dragTarget === child) {
          console.log("this.dragTarget.position", this.dragTarget.position);
          this.dragTarget = undefined;
        }
        child.cursor = "pointer";
      };

      child.on("pointerover", onOver);
      child.on("pointerout", onOut);
      child.on("pointerdown", onDown);

      // 👇 eventos globales: no dependen del hit-test
      child.on("globalpointermove", onMove);

      // pointerup dispara aunque el puntero ya no esté encima del objeto
      child.on("pointerup", onUp);
      child.on("pointerupoutside", onUp);

      child.addChild(overlay);

      this.editMap.set(child, {
        originalProperties,
        overlay,
        onOver,
        onOut,
        onDown,
        onMove,
        onUp,
      });
    });
  }

  /**
   * @description change beeting editing active state
   *
   * @returns {boolean} current state of isEditing
   */
  public toggleEdit(): boolean {
    if (this.isEditing) {
      this.desactivateEdit();
    } else {
      this.activateEdit();
    }
    return this.isEditing;
  }

  public activateEdit() {
    this.host.pause?.(pauseResumeOption);
    this.isEditing = true;
    this.makeChildrenEditable();
  }

  public desactivateEdit() {
    this.host.resume?.(pauseResumeOption);
    this.isEditing = false;

    this.dragTarget = undefined;
    this.undoChildrenEditable();
  }

  private undoChildrenEditable() {
    this.host.mainContainer?.children.forEach((child) => {
      const handlers = this.editMap.get(child);
      if (!handlers) return;

      child.off("pointerover", handlers.onOver);
      child.off("pointerout", handlers.onOut);
      child.off("pointerdown", handlers.onDown);
      child.off("globalpointermove", handlers.onMove);
      child.off("pointerup", handlers.onUp);
      child.off("pointerupoutside", handlers.onUp);

      child.cursor = handlers.originalProperties.cursor;
      child.eventMode = handlers.originalProperties.eventMode;
      child.removeChild(handlers.overlay);
      this.editMap.delete(child);
    });
  }
}
