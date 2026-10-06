export type TemaPosition = { x: number; y: number };
export type TemaMovement = "idle" | "walking-left" | "walking-right";

export const TEMA_WIDTH = 130.56;
export const TEMA_HEIGHT = 141.44;
const PADDING = 16;

export function clampTemaPosition(position: TemaPosition): TemaPosition {
  return {
    x: Math.min(rightEdge(), Math.max(PADDING, position.x)),
    y: Math.min(bottomEdge(), Math.max(PADDING, position.y))
  };
}

export function homePosition(): TemaPosition {
  return { x: Math.max(PADDING, window.innerWidth - TEMA_WIDTH - 24), y: bottomEdge() };
}

export function nextRoamingPosition(position: TemaPosition): TemaPosition {
  const distance = 140 + Math.random() * 190;
  const canMoveLeft = position.x - distance >= PADDING;
  const canMoveRight = position.x + distance <= rightEdge();
  const direction = canMoveLeft && canMoveRight ? (Math.random() > 0.5 ? 1 : -1) : canMoveRight ? 1 : -1;
  return clampTemaPosition({ ...position, x: position.x + direction * distance });
}

export function movementFor(from: TemaPosition, to: TemaPosition): TemaMovement {
  return to.x < from.x ? "walking-left" : "walking-right";
}

export function travelDuration(from: TemaPosition, to: TemaPosition): number {
  return Math.max(0.5, Math.abs(to.x - from.x) / 145);
}

function rightEdge(): number {
  return Math.max(PADDING, window.innerWidth - TEMA_WIDTH - PADDING);
}

function bottomEdge(): number {
  return Math.max(PADDING, window.innerHeight - TEMA_HEIGHT - PADDING);
}
