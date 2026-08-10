import { Container, Graphics } from "pixi.js";
import { Label } from "../Label";

export type CommandAction = "move" | "stop" | "hold" | "attack" | "patrol";

export interface CommandUICallbacks {
  onCommand(action: CommandAction): void;
}

export class CommandUI extends Container {
  private readonly buttons: { label: Label; bg: Graphics; action: CommandAction }[] = [];

  constructor(private readonly callbacks: CommandUICallbacks) {
    super();

    const commands: { action: CommandAction; key: string; label: string }[] = [
      { action: "move", key: "M", label: "Move" },
      { action: "stop", key: "S", label: "Stop" },
      { action: "hold", key: "H", label: "Hold" },
      { action: "attack", key: "A", label: "Attack" },
      { action: "patrol", key: "P", label: "Patrol" },
    ];

    const btnW = 64;
    const btnH = 28;
    const gap = 4;

    commands.forEach((cmd, i) => {
      const x = i * (btnW + gap);

      const bg = new Graphics()
        .roundRect(x, 0, btnW, btnH, 5)
        .fill({ color: 0x37474f, alpha: 0.9 })
        .stroke({ color: 0x78909c, width: 1 });
      bg.eventMode = "static";
      bg.cursor = "pointer";
      bg.on("pointerdown", (e) => {
        e.stopPropagation();
        this.callbacks.onCommand(cmd.action);
      });

      const label = new Label({
        text: `${cmd.key}\n${cmd.label}`,
        style: { fill: 0xb0bec5, fontSize: 9, lineHeight: 11, align: "center" },
      });
      label.position.set(x + btnW / 2, 4);

      this.addChild(bg);
      this.addChild(label);
      this.buttons.push({ label, bg, action: cmd.action });
    });

    this.visible = false;
  }

  setHighlight(action: CommandAction | null): void {
    for (const btn of this.buttons) {
      const active = btn.action === action;
      btn.bg.clear();
      const x = this.buttons.indexOf(btn) * 68;
      btn.bg
        .roundRect(x, 0, 64, 28, 5)
        .fill({ color: active ? 0xffd54f : 0x37474f, alpha: active ? 0.9 : 0.7 })
        .stroke({ color: active ? 0xffd54f : 0x78909c, width: 1 });
    }
  }
}
