/** Get the distance between a and b points */
export function getDistance(ax: number, ay: number, bx = 0, by = 0) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number) {
  return (1 - t) * a + t * b;
}

/** Clamp a number to minimum and maximum values */
export function clamp(v: number, min = 0, max = 1) {
  if (min > max) [min, max] = [max, min];
  return v < min ? min : v > max ? max : v;
}

export const ingresoCircunferencia = (
  objetoX: number,
  objetoY: number,
  targetX: number,
  targetY: number,
  radio: number,
): boolean => {
  return Math.pow(objetoX - targetX, 2) + Math.pow(objetoY - targetY, 2) <= Math.pow(radio, 2);
};
