export type ToolType = 'select' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'pen' | 'text' | 'sticky' | 'image' | 'eraser';
export type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'pen' | 'text' | 'sticky' | 'image' | 'group';
export type TextAlign = 'left' | 'center' | 'right';
export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Style {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeDash: number[];
  cornerRadius: number;
  fontSize: number;
  textAlign: TextAlign;
  textColor: string;
  backgroundColor: string;
}

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style: Style;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
  userId: string;
  timestamp: number;
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
}

export interface LineShape extends BaseShape {
  type: 'line';
  points: Point[];
}

export interface ArrowShape extends BaseShape {
  type: 'arrow';
  points: Point[];
}

export interface PenShape extends BaseShape {
  type: 'pen';
  points: Point[];
  pressure: number[];
}

export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  isEditing: boolean;
}

export interface StickyShape extends BaseShape {
  type: 'sticky';
  text: string;
  color: StickyColor;
  isEditing: boolean;
}

export interface ImageShape extends BaseShape {
  type: 'image';
  src: string;
  image: HTMLImageElement | null;
}

export interface GroupShape extends BaseShape {
  type: 'group';
  childrenIds: string[];
}

export type Shape = RectangleShape | EllipseShape | LineShape | ArrowShape | PenShape | TextShape | StickyShape | ImageShape | GroupShape;

export interface Operation {
  id: string;
  type: 'add' | 'remove' | 'update' | 'group' | 'ungroup';
  shapes: Shape[];
  previousShapes?: Shape[];
  userId: string;
  timestamp: number;
}

export interface UserCursor {
  userId: string;
  name: string;
  x: number;
  y: number;
  color: string;
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  shapes: Shape[];
  viewport: {
    zoom: number;
    panX: number;
    panY: number;
  };
}

export const DEFAULT_STYLE: Style = {
  strokeColor: '#1e1e1e',
  fillColor: 'transparent',
  strokeWidth: 2,
  strokeDash: [],
  cornerRadius: 0,
  fontSize: 16,
  textAlign: 'left',
  textColor: '#1e1e1e',
  backgroundColor: 'transparent'
};

export const STICKY_COLORS: Record<StickyColor, string> = {
  yellow: '#fef3c7',
  pink: '#fce7f3',
  blue: '#dbeafe',
  green: '#dcfce7',
  purple: '#ede9fe',
  orange: '#ffedd5'
};
