import type { CellCoord, GridConfig } from "../../../core/grid/GridConfig";
import type { Unit } from "../unidades/Unit";

export interface TargetSelectorOptions {
  hpWeight?: number;
  distanceWeight?: number;
  distributionWeight?: number;
  thresholdFrames?: number;
  underAttackFrames?: number;
}

export const DEFAULT_TARGET_SELECTOR_OPTIONS: Required<TargetSelectorOptions> = {
  hpWeight: 2.0,
  distanceWeight: 1.5,
  distributionWeight: 1.0,
  thresholdFrames: 30,
  underAttackFrames: 60,
};

export interface SelectionContext {
  unitCell: CellCoord;
  targets: Unit[];
  currentTarget: Unit | undefined;
  thresholdTicks: number;
  underAttackTicks: number;
  lastAttackerId?: string;
  melee: boolean;
  range: number;
  gridConfig: GridConfig;
  vision?: number;
}

function countActiveAttacks(target: Unit, allUnits: Unit[]): number {
  let count = 0;
  for (const unit of allUnits) {
    if (unit === target || !unit.active) continue;
    if (unit.targetToShoot === target || unit.pursuitTarget === target) count++;
  }
  return count;
}

export function selectBestTarget(ctx: SelectionContext): Unit | undefined {
  const opts = DEFAULT_TARGET_SELECTOR_OPTIONS;
  const { targets, unitCell, currentTarget, thresholdTicks, underAttackTicks, lastAttackerId, melee, range, vision, gridConfig } = ctx;

  if (targets.length === 0) return undefined;

  const effectiveRange = melee ? Math.max(1, range) : range;

  const distanceFn = melee
    ? (a: CellCoord, b: CellCoord) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))
    : (a: CellCoord, b: CellCoord) => Math.hypot(b.col - a.col, b.row - a.row);

  const validTargets = targets.filter((t) => {
    if (!t.active || !t.canBeProjectileTarget) return false;
    const cell = t.getGridCell(gridConfig);
    if (!cell) return false;
    if (vision !== undefined) {
      const dist = Math.hypot(cell.col - unitCell.col, cell.row - unitCell.row);
      if (dist > vision) return false;
    }
    return true;
  });

  if (validTargets.length === 0) return undefined;

  if (underAttackTicks > 0 && lastAttackerId) {
    const attacker = validTargets.find((t) => t.getId() === lastAttackerId);
    if (attacker) return attacker;
  }

  if (currentTarget && thresholdTicks < opts.thresholdFrames) {
    const currentCell = currentTarget.getGridCell(gridConfig);
    if (currentTarget.active && currentCell && distanceFn(unitCell, currentCell) <= effectiveRange) {
      return currentTarget;
    }
  }

  let best: Unit | undefined;
  let bestScore = -Infinity;

  for (const target of validTargets) {
    const targetCell = target.getGridCell(gridConfig);
    if (!targetCell) continue;

    const dist = distanceFn(unitCell, targetCell);
    if (dist > effectiveRange) continue;

    const hpRatio = target.model.hp / Math.max(1, target.model.maxHp);
    const hpScore = opts.hpWeight * (1 - hpRatio);

    const normalizedDist = dist / Math.max(1, Math.max(gridConfig.gridWidth, gridConfig.gridHeight));
    const distScore = -opts.distanceWeight * normalizedDist;

    const attackerCount = countActiveAttacks(target, targets);
    const distroScore = -opts.distributionWeight * attackerCount;

    const totalScore = hpScore + distScore + distroScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      best = target;
    }
  }

  return best;
}
