import type { Shape, Style } from './types';
import { DEFAULT_STYLE } from './types';
import { generateId } from './utils';

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  shapes: Shape[];
}

const S = (x: number, y: number, w: number, h: number, style?: Partial<Style>): Partial<Shape> => ({
  x, y, width: w, height: h, rotation: 0,
  style: { ...DEFAULT_STYLE, ...style },
  zIndex: 0, createdAt: Date.now(), updatedAt: Date.now(),
  userId: 'template', timestamp: Date.now()
});

const R = (x: number, y: number, w: number, h: number, style?: Partial<Style>): Shape => ({
  id: generateId(), type: 'rectangle',
  ...S(x, y, w, h, style)
} as Shape);

const T = (x: number, y: number, w: number, text: string, style?: Partial<Style>): Shape => ({
  id: generateId(), type: 'text',
  ...S(x, y, w, 30, style),
  text, isEditing: false
} as Shape);

const ST = (x: number, y: number, text: string, color: string, bgColor: string): Shape => ({
  id: generateId(), type: 'sticky',
  x, y, width: 180, height: 120, rotation: 0,
  style: { ...DEFAULT_STYLE, backgroundColor: bgColor },
  zIndex: 0, createdAt: Date.now(), updatedAt: Date.now(),
  userId: 'template', timestamp: Date.now(),
  text, color: 'yellow' as any, isEditing: false
} as Shape);

export const templates: Template[] = [
  {
    id: 'flowchart',
    name: '流程图',
    description: '基础流程图模板',
    icon: 'M6 3h12v6H6zM6 15h12v6H6zM12 9v6',
    shapes: [
      R(-300, -200, 200, 80, { fillColor: '#dbeafe', strokeColor: '#3b82f6' }),
      T(-280, -180, 160, '开始', { textAlign: 'center', textColor: '#1e40af' }),
      R(-300, -60, 200, 80, { fillColor: '#fef3c7', strokeColor: '#f59e0b' }),
      T(-280, -40, 160, '处理步骤', { textAlign: 'center', textColor: '#92400e' }),
      R(-300, 80, 200, 80, { fillColor: '#dcfce7', strokeColor: '#22c55e' }),
      T(-280, 100, 160, '判断', { textAlign: 'center', textColor: '#166534' }),
      R(0, 80, 200, 80, { fillColor: '#fce7f3', strokeColor: '#ec4899' }),
      T(20, 100, 160, '是', { textAlign: 'center', textColor: '#9d174d' }),
      R(0, 220, 200, 80, { fillColor: '#fee2e2', strokeColor: '#ef4444' }),
      T(20, 240, 160, '结束', { textAlign: 'center', textColor: '#991b1b' }),
      {
        id: generateId(), type: 'arrow',
        x: -200, y: -120, width: 0, height: 100,
        rotation: 0, style: { ...DEFAULT_STYLE, strokeColor: '#6b7280' },
        zIndex: 0, createdAt: Date.now(), updatedAt: Date.now(),
        userId: 'template', timestamp: Date.now(),
        points: [{ x: -200, y: -120 }, { x: -200, y: -60 }]
      } as Shape,
      {
        id: generateId(), type: 'arrow',
        x: -200, y: 20, width: 0, height: 60,
        rotation: 0, style: { ...DEFAULT_STYLE, strokeColor: '#6b7280' },
        zIndex: 0, createdAt: Date.now(), updatedAt: Date.now(),
        userId: 'template', timestamp: Date.now(),
        points: [{ x: -200, y: 20 }, { x: -200, y: 80 }]
      } as Shape,
      {
        id: generateId(), type: 'arrow',
        x: -100, y: 120, width: 100, height: 0,
        rotation: 0, style: { ...DEFAULT_STYLE, strokeColor: '#6b7280' },
        zIndex: 0, createdAt: Date.now(), updatedAt: Date.now(),
        userId: 'template', timestamp: Date.now(),
        points: [{ x: -100, y: 120 }, { x: 0, y: 120 }]
      } as Shape,
      {
        id: generateId(), type: 'arrow',
        x: 100, y: 160, width: 0, height: 60,
        rotation: 0, style: { ...DEFAULT_STYLE, strokeColor: '#6b7280' },
        zIndex: 0, createdAt: Date.now(), updatedAt: Date.now(),
        userId: 'template', timestamp: Date.now(),
        points: [{ x: 100, y: 160 }, { x: 100, y: 220 }]
      } as Shape
    ]
  },
  {
    id: 'mindmap',
    name: '思维导图',
    description: '中心发散式思维导图',
    icon: 'M12 3v6M9 9h6M12 15v6M9 15H6M15 15h3M6 12v3M18 12v3',
    shapes: [
      R(-80, -60, 160, 120, { fillColor: '#fef3c7', strokeColor: '#f59e0b', cornerRadius: 60, strokeWidth: 3 }),
      T(-60, -10, 120, '中心主题', { textAlign: 'center', fontSize: 18, textColor: '#92400e' }),
      R(-350, -250, 180, 60, { fillColor: '#dbeafe', strokeColor: '#3b82f6', cornerRadius: 10 }),
      T(-330, -230, 140, '分支一', { textAlign: 'center', textColor: '#1e40af' }),
      R(-500, -150, 150, 50, { fillColor: '#e0e7ff', strokeColor: '#6366f1', cornerRadius: 8 }),
      T(-485, -135, 120, '子主题', { textAlign: 'center', fontSize: 14, textColor: '#3730a3' }),
      R(-350, 190, 180, 60, { fillColor: '#dcfce7', strokeColor: '#22c55e', cornerRadius: 10 }),
      T(-330, 210, 140, '分支二', { textAlign: 'center', textColor: '#166534' }),
      R(-500, 100, 150, 50, { fillColor: '#d1fae5', strokeColor: '#10b981', cornerRadius: 8 }),
      T(-485, 115, 120, '子主题', { textAlign: 'center', fontSize: 14, textColor: '#047857' }),
      R(170, -250, 180, 60, { fillColor: '#fce7f3', strokeColor: '#ec4899', cornerRadius: 10 }),
      T(190, -230, 140, '分支三', { textAlign: 'center', textColor: '#9d174d' }),
      R(350, -150, 150, 50, { fillColor: '#fbcfe8', strokeColor: '#f472b6', cornerRadius: 8 }),
      T(365, -135, 120, '子主题', { textAlign: 'center', fontSize: 14, textColor: '#be185d' }),
      R(170, 190, 180, 60, { fillColor: '#fed7aa', strokeColor: '#f97316', cornerRadius: 10 }),
      T(190, 210, 140, '分支四', { textAlign: 'center', textColor: '#9a3412' }),
      R(350, 100, 150, 50, { fillColor: '#ffedd5', strokeColor: '#fb923c', cornerRadius: 8 }),
      T(365, 115, 120, '子主题', { textAlign: 'center', fontSize: 14, textColor: '#c2410c' })
    ]
  },
  {
    id: 'kanban',
    name: '看板便签',
    description: '项目管理看板',
    icon: 'M3 3h6v18H3zM9 3h6v18H9zM15 3h6v18H15z',
    shapes: [
      R(-500, -300, 280, 60, { fillColor: '#fee2e2', strokeColor: '#ef4444' }),
      T(-470, -280, 220, '待办 Todo', { textAlign: 'center', fontSize: 20, textColor: '#991b1b' }),
      R(-150, -300, 280, 60, { fillColor: '#fef3c7', strokeColor: '#f59e0b' }),
      T(-120, -280, 220, '进行中 In Progress', { textAlign: 'center', fontSize: 20, textColor: '#92400e' }),
      R(200, -300, 280, 60, { fillColor: '#dcfce7', strokeColor: '#22c55e' }),
      T(230, -280, 220, '已完成 Done', { textAlign: 'center', fontSize: 20, textColor: '#166534' }),
      ST(-480, -220, '需求分析\n- 用户调研\n- 竞品分析', 'yellow', '#fef3c7'),
      ST(-480, -80, '设计评审\n- UI稿确认\n- 交互验收', 'pink', '#fce7f3'),
      ST(-480, 60, '技术方案\n- 架构设计\n- 接口定义', 'blue', '#dbeafe'),
      ST(-130, -220, '前端开发\n- 页面开发\n- 接口联调', 'yellow', '#fef3c7'),
      ST(-130, -80, '后端开发\n- API实现\n- 数据库', 'green', '#dcfce7'),
      ST(220, -220, '需求文档\n完成度: 100%', 'green', '#dcfce7'),
      ST(220, -80, '原型设计\n完成度: 100%', 'purple', '#ede9fe')
    ]
  },
  {
    id: 'user-journey',
    name: '用户旅程图',
    description: '用户体验旅程地图',
    icon: 'M3 12h18M3 6h18M3 18h18M5 3v18M12 3v18M19 3v18',
    shapes: [
      R(-600, -350, 1200, 60, { fillColor: '#f1f5f9', strokeColor: '#94a3b8' }),
      T(-550, -330, 100, '阶段', { textAlign: 'center', fontSize: 16, textColor: '#475569' }),
      T(-350, -330, 100, '发现', { textAlign: 'center', fontSize: 16, textColor: '#475569' }),
      T(-150, -330, 100, '考虑', { textAlign: 'center', fontSize: 16, textColor: '#475569' }),
      T(50, -330, 100, '决策', { textAlign: 'center', fontSize: 16, textColor: '#475569' }),
      T(250, -330, 100, '行动', { textAlign: 'center', fontSize: 16, textColor: '#475569' }),
      T(450, -330, 100, '忠诚', { textAlign: 'center', fontSize: 16, textColor: '#475569' }),
      R(-600, -270, 1200, 60, { fillColor: '#fef3c7', strokeColor: '#fbbf24' }),
      T(-550, -250, 100, '行为', { textAlign: 'center', fontSize: 14, textColor: '#92400e' }),
      T(-350, -250, 100, '搜索\n浏览', { textAlign: 'center', fontSize: 14, textColor: '#78350f' }),
      T(-150, -250, 100, '比较\n阅读评论', { textAlign: 'center', fontSize: 14, textColor: '#78350f' }),
      T(50, -250, 100, '对比价格\n查看优惠', { textAlign: 'center', fontSize: 14, textColor: '#78350f' }),
      T(250, -250, 100, '下单\n支付', { textAlign: 'center', fontSize: 14, textColor: '#78350f' }),
      T(450, -250, 100, '评价\n复购', { textAlign: 'center', fontSize: 14, textColor: '#78350f' }),
      R(-600, -190, 1200, 60, { fillColor: '#dbeafe', strokeColor: '#60a5fa' }),
      T(-550, -170, 100, '痛点', { textAlign: 'center', fontSize: 14, textColor: '#1e40af' }),
      T(-350, -170, 100, '信息过载', { textAlign: 'center', fontSize: 14, textColor: '#1e3a8a' }),
      T(-150, -170, 100, '选择困难', { textAlign: 'center', fontSize: 14, textColor: '#1e3a8a' }),
      T(50, -170, 100, '价格敏感', { textAlign: 'center', fontSize: 14, textColor: '#1e3a8a' }),
      T(250, -170, 100, '支付流程', { textAlign: 'center', fontSize: 14, textColor: '#1e3a8a' }),
      T(450, -170, 100, '物流等待', { textAlign: 'center', fontSize: 14, textColor: '#1e3a8a' }),
      R(-600, -110, 1200, 60, { fillColor: '#dcfce7', strokeColor: '#4ade80' }),
      T(-550, -90, 100, '机会', { textAlign: 'center', fontSize: 14, textColor: '#166534' }),
      T(-350, -90, 100, '推荐算法', { textAlign: 'center', fontSize: 14, textColor: '#14532d' }),
      T(-150, -90, 100, '智能对比', { textAlign: 'center', fontSize: 14, textColor: '#14532d' }),
      T(50, -90, 100, '优惠提醒', { textAlign: 'center', fontSize: 14, textColor: '#14532d' }),
      T(250, -90, 100, '一键支付', { textAlign: 'center', fontSize: 14, textColor: '#14532d' }),
      T(450, -90, 100, '会员权益', { textAlign: 'center', fontSize: 14, textColor: '#14532d' })
    ]
  }
];
