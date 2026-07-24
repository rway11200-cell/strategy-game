import { Container, Graphics } from "pixi.js";
import { Unit } from "../../core/unidades/Unit";
import { Label } from "../Label";

export class SelectedUnitUI extends Container {
  private readonly title: Label;
  private readonly details: Label;

  constructor() {
    super();
    const width = 250;
    const height = 152;
    const background = new Graphics()
      .roundRect(0, 0, width, height, 8)
      .fill({ color: 0x101820, alpha: 0.88 })
      .stroke({ color: 0xffd54f, width: 2, alpha: 0.9 });
    this.addChild(background);

    this.title = new Label({
      text: "UNIT SELECTED",
      style: { fill: 0xffd54f, fontSize: 14, fontWeight: "bold", align: "left" },
    });
    this.title.anchor.set(0, 0);
    this.title.position.set(14, 9);
    this.addChild(this.title);

    this.details = new Label({
      text: "",
      style: { fill: 0xf4f7fb, fontSize: 12, lineHeight: 17, align: "left" },
    });
    this.details.anchor.set(0, 0);
    this.details.position.set(14, 30);
    this.addChild(this.details);
    this.visible = false;
  }

  public showUnit(unit?: Unit): void {
    this.visible = Boolean(unit);
    if (!unit) return;

    const cooldownMs = unit.model.cooldown;
    const atkSpeed = cooldownMs > 0 ? (1000 / cooldownMs).toFixed(1) : "0";

    this.title.text = `${unit.team.toUpperCase()} UNIT`;
    this.details.text = [
      `HP  ${Math.ceil(unit.hp)} / ${Math.ceil(unit.maxHp)}    DMG  ${unit.attackDamage}`,
      `Speed  ${unit.speed.toFixed(1)}    Atk/s  ${atkSpeed}`,
      `Range  ${unit.range}    Vision  ${unit.vision}`,
      `Activity  ${unit.activity}    Order  ${unit.currentCommand?.type ?? "none"}`,
    ].join("\n");
  }
}
