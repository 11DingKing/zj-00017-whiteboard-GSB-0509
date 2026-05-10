# Bugfix Notes

## Bug 1: 鼠标中键平移松开后画布"弹回"

- **定位**: `src/lib/components/Canvas.svelte` → `handleMouseUp()`
- **根因**: `handleMouseUp` 中 `isPanning` 分支只设了 `isPanning = false` 就 return，没有用 `pointerup` 事件的最终鼠标坐标做一次偏移提交。最后一次 `pointermove` 与 `pointerup` 之间鼠标的移动距离被丢弃，导致 store 中 `panX/panY` 停留在最后一次 pointermove 的值，与鼠标实际松开位置有偏差。
- **修复**: 在 `handleMouseUp` 的 `isPanning` 分支中，用 `e.clientX/clientY` 相对 `panStartX/panStartY` 计算最终偏移，调用 `store.panX.set(panStartPanX + dx)` / `store.panY.set(panStartPanY + dy)` 提交后再清除 `isPanning`。

---

## Bug 2: 撤销/重做历史栈每次 pointermove 都 push

- **定位**: `src/lib/stores.ts` → `pushUndo()`
- **根因**: `pushUndo` 无条件将每个 Operation 追加到 undoStack。Canvas 拖动已用 `broadcast=false` 跳过中间步骤，但 PropertiesPanel 中属性滑块等连续输入每次 input 事件都调用 `store.updateShapes(updates)`（默认 `broadcast=true`），每次都 pushUndo 一条记录，Ctrl+Z 需按几十次。
- **修复**: 新增 `canMergeUpdate()` 判断函数——若新操作与栈顶操作都是 `update` 类型、影响相同 shape IDs、时间间隔 ≤ 200ms，则合并为一条（保留栈顶的 `previousShapes`，替换 `shapes` 为新值，更新 timestamp）。`add`/`remove`/`group`/`ungroup` 等瞬时操作因 type 不是 `update` 永远不会被合并，保持即时入栈。

---

## Bug 3: 导出 PNG 只截到视口内可见区域

- **定位**: `src/lib/exporter.ts` → `exportPNG()`
- **根因**: 原代码用 `getBounds()`（来自 utils.ts）计算导出边界，`getBounds` 只用 `shape.x + shape.width` 和 `shape.y + shape.height`，对 `line`/`arrow`/`pen` 类型不考虑其 `points` 数组的实际范围。当 points 端点超出 shape 的包围盒时，bounds 偏小，画布外的图形被裁剪。白色背景原代码已有，但因 bounds 不足导致部分内容落在画布外。
- **修复**: 在 exporter.ts 中新增 `getFullBounds()` 函数，优先用 `points` 数组的实际坐标计算边界，无 points 时回退到 `shape.x/width/height`。`exportPNG` 和 `exportSVG` 均改用 `getFullBounds`，移除对 `getBounds` 的 import。

---

## Bug 4: 选中框手柄缩放后偏移

- **定位**: `src/lib/components/SelectionHandles.svelte` → reactive 语句 `$: bounds = ...`
- **根因**: 与 Bug 3 同源。原代码用 `getBounds(selectedShapes)` 计算选中图形边界，不考虑 `line`/`arrow`/`pen` 的 `points` 实际范围，导致 bounds 与画布上实际渲染位置不一致。缩放后误差被 `$zoom` 放大，偏移更明显。
- **修复**: 在 SelectionHandles.svelte 中新增 `getSelectionBounds()` 函数（逻辑与 exporter.ts 的 `getFullBounds` 一致），优先用 `points` 计算边界。替换原 `getBounds` 调用，移除对 `getBounds` 的 import。
