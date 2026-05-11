# 画布交互 Bug 修复说明

## Bug 1: 鼠标中键平移后画布"弹回"

### 定位
- **文件**: `src/lib/components/Canvas.svelte`
- **函数**: `startPan()` (第 276 行)

### 根因
`startPan` 函数中使用本地响应式变量 `$panX` 和 `$panY` 记录平移起始位置，这些变量是通过 `subscribe` 订阅更新的，存在响应式延迟。当用户快速按住中键拖动时，获取到的起始值不是 store 的最新值，导致平移结束后画布"弹回"一段距离。

### 修复方式
在 `startPan` 函数中使用 `get(store.panX)` 和 `get(store.panY)` 直接从 store 同步获取最新值，确保平移起始位置准确。

```typescript
// 修复前
panStartPanX = $panX;
panStartPanY = $panY;

// 修复后
panStartPanX = get(store.panX);
panStartPanY = get(store.panY);
```

---

## Bug 2: 撤销/重做历史栈每次移动都入栈

### 定位
- **文件**: `src/lib/stores.ts`
- **函数**: `pushUndo()` (第 212 行)、`updateShape()` (第 98 行)、`updateShapes()` (第 117 行)

### 根因
每次调用 `updateShape` 或 `updateShapes` 时，只要 `broadcast=true` 就立即调用 `pushUndo`。拖动图形时每次 `pointermove` 都会触发更新，导致历史栈被大量重复记录填满，Ctrl+Z 需要按几十次才能撤回到拖动前的状态。

### 修复方式
1. 添加防抖机制，对 `type: 'update'` 的操作进行 200ms 延迟入栈
2. 连续的 update 操作会合并成一条历史记录（不断更新 pending 的操作内容）
3. 对 `add`/`remove`/`group`/`ungroup` 等瞬时操作保持即时入栈
4. 执行 `undo`/`redo` 前先 flush 待处理的 update 操作

关键修改：
- 新增 `debouncedUpdateOp`、`debounceTimer` 变量和 `DEBOUNCE_DELAY = 200` 常量
- 新增 `flushDebouncedUpdate()` 函数用于提交待处理的 update
- 修改 `pushUndo()` 根据操作类型走不同逻辑
- `undo()` 和 `redo()` 开头先调用 `flushDebouncedUpdate()`

---

## Bug 3: 导出 PNG 只截到视口内可见区域

### 定位
- **文件**: `src/lib/exporter.ts`
- **函数**: `exportPNG()` (第 73 行)、`getBounds()` (来自 `utils.ts`)

### 根因
1. 原代码使用 `utils.ts` 中的 `getBounds()` 计算边界，但该函数只计算图形的矩形包围盒，没有考虑图形旋转后的实际边界
2. 导致有旋转角度的图形在导出时部分内容被裁切
3. `onlySelection` 参数名存实亡（三元表达式两个分支都是 `shapes`）

### 修复方式
1. 新增 `getRotatedBounds(shape)` 函数计算单个旋转图形的实际边界
   - 计算图形四个角点旋转后的坐标
   - 取 min/max 得到实际边界
2. 新增 `getBoundsWithRotation(shapes)` 函数计算多个图形的总边界
3. `exportPNG()` 使用新的边界计算函数确保导出所有图形

---

## Bug 4: 选中多个图形时控制点位置偏移

### 定位
- **文件**: `src/lib/components/SelectionHandles.svelte`
- **函数**: reactive 语句 `$: bounds = ...` (第 67 行)

### 根因
使用 `getBounds(selectedShapes)` 计算选中框边界，但该函数没有考虑图形旋转。当选中有旋转角度的图形时，计算出的边界框不准确，导致 8 个控制点位置偏移，特别是在缩放过画布之后问题更明显。

### 修复方式
1. 新增 `getRotatedCorners(shape)` 函数计算图形旋转后的四个角点坐标
2. 新增 `getSelectionBounds(shapes)` 函数：
   - 遍历所有选中图形
   - 对每个图形计算旋转后的四个角点
   - 取所有角点的 min/max 得到总边界
3. 将 reactive 语句改为使用新的边界计算函数：
   ```typescript
   // 修复前
   $: bounds = selectedShapes.length > 0 ? getBounds(selectedShapes) : null;

   // 修复后
   $: bounds = getSelectionBounds(selectedShapes);
   ```
