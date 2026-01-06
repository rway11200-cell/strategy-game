import { Container, PointData, Ticker } from "pixi.js";

// Solo importan esas direcciones por ahora
export type DireccionDelMovimiento = "izquierda" | "derecha";

export type ResultadoCaminar = {
  llegoObjetivo: boolean;
  direccion?: DireccionDelMovimiento;
};

// Componente destinado a mover algo del punto A al B, debe ser llamado reiteradamente en un Ticket
export class Movimiento {
  public velocidad: number;
  public activo: boolean;

  constructor(velocidad = 1, activo = true) {
    this.velocidad = velocidad;
    this.activo = activo;
  }
  puedeCaminar(): boolean {
    return this.velocidad > 0 && this.activo;
  }
  caminar(obj: Container, target: PointData, t: Ticker, tolerancia = 0.5): ResultadoCaminar {
    if (!this.puedeCaminar()) return { llegoObjetivo: false };

    const dx = target.x - obj.position.x;
    const dy = target.y - obj.position.y;

    let direccion: DireccionDelMovimiento | undefined;
    if (dx > 0) {
      direccion = "derecha";
    } else if (dx < 0) {
      direccion = "izquierda";
    }

    const dist = Math.hypot(dx, dy);
    if (dist <= tolerancia) {
      obj.position.set(target.x, target.y);
      return { llegoObjetivo: true, direccion };
    }

    const step = this.velocidad * t.deltaTime;
    if (step >= dist) {
      obj.position.set(target.x, target.y);
      return { llegoObjetivo: true, direccion };
    }

    obj.position.set(obj.position.x + (dx / dist) * step, obj.position.y + (dy / dist) * step);
    return { llegoObjetivo: false, direccion };
  }
}
