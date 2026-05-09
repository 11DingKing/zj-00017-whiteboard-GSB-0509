import type { Point, Shape, Bounds } from './types';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function snapToGrid(value: number, gridSize: number = 20): number {
  return Math.round(value / gridSize) * gridSize;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

export function getCenter(shape: Shape): Point {
  return {
    x: shape.x + shape.width / 2,
    y: shape.y + shape.height / 2
  };
}

export function getBounds(shapes: Shape[]): Bounds {
  if (shapes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const shape of shapes) {
    minX = Math.min(minX, shape.x);
    minY = Math.min(minY, shape.y);
    maxX = Math.max(maxX, shape.x + shape.width);
    maxY = Math.max(maxY, shape.y + shape.height);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function pointInBounds(point: Point, bounds: Bounds, padding: number = 0): boolean {
  return (
    point.x >= bounds.x - padding &&
    point.x <= bounds.x + bounds.width + padding &&
    point.y >= bounds.y - padding &&
    point.y <= bounds.y + bounds.height + padding
  );
}

export function pointInRotatedBounds(point: Point, shape: Shape): boolean {
  const center = getCenter(shape);
  const angle = -shape.rotation * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const rotatedX = center.x + dx * cos - dy * sin;
  const rotatedY = center.y + dx * sin + dy * cos;
  return (
    rotatedX >= shape.x &&
    rotatedX <= shape.x + shape.width &&
    rotatedY >= shape.y &&
    rotatedY <= shape.y + shape.height
  );
}

export function pointOnLine(point: Point, p1: Point, p2: Point, threshold: number = 5): boolean {
  const d = distance(p1, p2);
  if (d === 0) return distance(point, p1) <= threshold;
  const t = Math.max(0, Math.min(1, ((point.x - p1.x) * (p2.x - p1.x) + (point.y - p1.y) * (p2.y - p1.y)) / (d * d)));
  const projection = {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  };
  return distance(point, projection) <= threshold;
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as T;
  const clone = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = deepClone(obj[key]);
    }
  }
  return clone;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}
