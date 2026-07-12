import { LevelContext } from "../cargador/LevelContext";
import { LevelAction } from "../cargador/LevelEventManager";

export class NotificationAction implements LevelAction {
  constructor(private text: string) {}
  getName(): string {
    return "NotificationAction";
  }
  update(_: number, context: LevelContext): boolean {
    context.showMessage(this.text);
    return true;
  }
}
