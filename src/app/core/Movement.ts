import { Container, PointData, Ticker } from "pixi.js";

export type MovementDirection = "left" | "right";

export type WalkResult = {
  reachedTarget: boolean;
  direction?: MovementDirection;
};

export function interpolatePosition(
  obj: Container,
  from: PointData,
  to: PointData,
  progress: number,
): void {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  obj.position.set(
    from.x + (to.x - from.x) * clampedProgress,
    from.y + (to.y - from.y) * clampedProgress,
  );
}

export class Movement {
  public speed: number;
  public active: boolean;

  constructor(speed = 1, active = true) {
    this.speed = speed;
    this.active = active;
  }
  canWalk(): boolean {
    return this.speed > 0 && this.active;
  }
  walk(obj: Container, target: PointData, t: Ticker, tolerance = 0.5): WalkResult {
    if (!this.canWalk()) return { reachedTarget: false };

    const dx = target.x - obj.position.x;
    const dy = target.y - obj.position.y;

    let direction: MovementDirection | undefined;
    if (dx > 0) {
      direction = "right";
    } else if (dx < 0) {
      direction = "left";
    }

    const dist = Math.hypot(dx, dy);
    if (dist <= tolerance) {
      obj.position.set(target.x, target.y);
      return { reachedTarget: true, direction };
    }

    const step = this.speed * t.deltaTime;
    if (step >= dist) {
      obj.position.set(target.x, target.y);
      return { reachedTarget: true, direction };
    }

    obj.position.set(obj.position.x + (dx / dist) * step, obj.position.y + (dy / dist) * step);
    return { reachedTarget: false, direction };
  }
}
