import type { Shape, Project, Point } from './types';
import { getBounds } from './utils';

export function exportPNG(shapes: Shape[], onlySelection: boolean = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas not supported'));

    const exportShapes = onlySelection ? shapes : shapes;
    const bounds = getBounds(exportShapes);
    const padding = 20;
    const scale = 2;
    canvas.width = (bounds.width + padding * 2) * scale;
    canvas.height = (bounds.height + padding * 2) * scale;
    ctx.scale(scale, scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
    ctx.save();
    ctx.translate(-bounds.x + padding, -bounds.y + padding);

    const sorted = [...exportShapes].sort((a, b) => a.zIndex - b.zIndex);
    for (const shape of sorted) {
      drawShape(ctx, shape);
    }

    ctx.restore();
    resolve(canvas.toDataURL('image/png'));
  });
}

export function exportSVG(shapes: Shape[], onlySelection: boolean = false): string {
  const exportShapes = onlySelection ? shapes : shapes;
  const bounds = getBounds(exportShapes);
  const padding = 20;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width + padding * 2}" height="${bounds.height + padding * 2}" viewBox="0 0 ${bounds.width + padding * 2} ${bounds.height + padding * 2}">`;
  svg += `<rect x="0" y="0" width="100%" height="100%" fill="white"/>`;
  svg += `<g transform="translate(${padding - bounds.x}, ${padding - bounds.y})">`;

  const sorted = [...exportShapes].sort((a, b) => a.zIndex - b.zIndex);
  for (const shape of sorted) {
    svg += shapeToSVG(shape);
  }

  svg += `</g></svg>`;
  return svg;
}

export function exportJSON(project: Project): string {
  const data = JSON.stringify(project, (key, value) => {
    if (key === 'image') return undefined;
    return value;
  }, 2);
  return data;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save();
  if (shape.rotation !== 0) {
    const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
    ctx.translate(center.x, center.y);
    ctx.rotate(shape.rotation * Math.PI / 180);
    ctx.translate(-center.x, -center.y);
  }
  ctx.lineWidth = shape.style.strokeWidth;
  ctx.strokeStyle = shape.style.strokeColor;
  ctx.fillStyle = shape.style.fillColor;
  if (shape.style.strokeDash.length > 0) {
    ctx.setLineDash(shape.style.strokeDash);
  }

  switch (shape.type) {
    case 'rectangle':
      drawRect(ctx, shape);
      break;
    case 'ellipse':
      drawEllipse(ctx, shape);
      break;
    case 'line':
      drawLine(ctx, shape);
      break;
    case 'arrow':
      drawArrow(ctx, shape);
      break;
    case 'pen':
      drawPen(ctx, shape);
      break;
    case 'text':
      drawText(ctx, shape);
      break;
    case 'sticky':
      drawSticky(ctx, shape);
      break;
    case 'image':
      drawImage(ctx, shape);
      break;
  }
  ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, shape: Shape) {
  const r = Math.min(shape.style.cornerRadius, shape.width / 2, shape.height / 2);
  ctx.beginPath();
  if (r > 0) {
    ctx.moveTo(shape.x + r, shape.y);
    ctx.lineTo(shape.x + shape.width - r, shape.y);
    ctx.quadraticCurveTo(shape.x + shape.width, shape.y, shape.x + shape.width, shape.y + r);
    ctx.lineTo(shape.x + shape.width, shape.y + shape.height - r);
    ctx.quadraticCurveTo(shape.x + shape.width, shape.y + shape.height, shape.x + shape.width - r, shape.y + shape.height);
    ctx.lineTo(shape.x + r, shape.y + shape.height);
    ctx.quadraticCurveTo(shape.x, shape.y + shape.height, shape.x, shape.y + shape.height - r);
    ctx.lineTo(shape.x, shape.y + r);
    ctx.quadraticCurveTo(shape.x, shape.y, shape.x + r, shape.y);
  } else {
    ctx.rect(shape.x, shape.y, shape.width, shape.height);
  }
  if (shape.style.fillColor !== 'transparent') ctx.fill();
  if (shape.style.strokeWidth > 0) ctx.stroke();
}

function drawEllipse(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.beginPath();
  ctx.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, shape.width / 2, shape.height / 2, 0, 0, Math.PI * 2);
  if (shape.style.fillColor !== 'transparent') ctx.fill();
  if (shape.style.strokeWidth > 0) ctx.stroke();
}

function drawLine(ctx: CanvasRenderingContext2D, shape: Shape) {
  const points = (shape as any).points || [{ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }];
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, shape: Shape) {
  const points = (shape as any).points || [{ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }];
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const headLength = 15;
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(last.x - headLength * Math.cos(angle - Math.PI / 6), last.y - headLength * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(last.x - headLength * Math.cos(angle + Math.PI / 6), last.y - headLength * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function drawPen(ctx: CanvasRenderingContext2D, shape: Shape) {
  const points = (shape as any).points || [];
  if (points.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
  }
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, shape: Shape) {
  const text = (shape as any).text || '';
  if (!text) return;
  ctx.font = `${shape.style.fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = shape.style.textColor;
  ctx.textBaseline = 'top';
  ctx.textAlign = shape.style.textAlign;
  let x = shape.x;
  if (shape.style.textAlign === 'center') x = shape.x + shape.width / 2;
  if (shape.style.textAlign === 'right') x = shape.x + shape.width;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, shape.y + i * (shape.style.fontSize * 1.2));
  }
}

function drawSticky(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.fillStyle = shape.style.backgroundColor;
  ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);

  const text = (shape as any).text || '';
  if (!text) return;
  ctx.font = `${shape.style.fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = '#1e1e1e';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const padding = 10;
  const maxWidth = shape.width - padding * 2;
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    const metrics = ctx.measureText(test);
    if (metrics.width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], shape.x + padding, shape.y + padding + i * (shape.style.fontSize * 1.2));
  }
}

function drawImage(ctx: CanvasRenderingContext2D, shape: Shape) {
  const imgShape = shape as any;
  if (imgShape.image) {
    ctx.drawImage(imgShape.image, shape.x, shape.y, shape.width, shape.height);
  }
}

function shapeToSVG(shape: Shape): string {
  let transform = '';
  if (shape.rotation !== 0) {
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    transform = ` transform="rotate(${shape.rotation} ${cx} ${cy})"`;
  }
  const stroke = shape.style.strokeColor;
  const fill = shape.style.fillColor === 'transparent' ? 'none' : shape.style.fillColor;
  const strokeWidth = shape.style.strokeWidth;
  const strokeDasharray = shape.style.strokeDash.length > 0 ? ` stroke-dasharray="${shape.style.strokeDash.join(' ')}"` : '';

  switch (shape.type) {
    case 'rectangle':
      const r = Math.min(shape.style.cornerRadius, shape.width / 2, shape.height / 2);
      return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${strokeDasharray}${transform}/>`;

    case 'ellipse':
      return `<ellipse cx="${shape.x + shape.width / 2}" cy="${shape.y + shape.height / 2}" rx="${shape.width / 2}" ry="${shape.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${strokeDasharray}${transform}/>`;

    case 'line':
    case 'arrow': {
      const points = (shape as any).points || [{ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }];
      const d = points.map((p: Point, i: number) => (i === 0 ? 'M' : 'L') + `${p.x} ${p.y}`).join(' ');
      let svg = `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${strokeDasharray}${transform}/>`;
      if (shape.type === 'arrow' && points.length >= 2) {
        const last = points[points.length - 1];
        const prev = points[points.length - 2];
        const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
        const len = 15;
        const p1 = { x: last.x - len * Math.cos(angle - Math.PI / 6), y: last.y - len * Math.sin(angle - Math.PI / 6) };
        const p2 = { x: last.x - len * Math.cos(angle + Math.PI / 6), y: last.y - len * Math.sin(angle + Math.PI / 6) };
        svg += `<path d="M${last.x} ${last.y} L${p1.x} ${p1.y} M${last.x} ${last.y} L${p2.x} ${p2.y}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${transform}/>`;
      }
      return svg;
    }

    case 'pen': {
      const points = (shape as any).points || [];
      if (points.length < 2) return '';
      const d = points.map((p: Point, i: number) => (i === 0 ? 'M' : 'L') + `${p.x} ${p.y}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${strokeDasharray}${transform}/>`;
    }

    case 'text': {
      const text = (shape as any).text || '';
      if (!text) return '';
      let x = shape.x;
      if (shape.style.textAlign === 'center') x = shape.x + shape.width / 2;
      if (shape.style.textAlign === 'right') x = shape.x + shape.width;
      const lines = text.split('\n');
      return lines.map((line: string, i: number) =>
        `<text x="${x}" y="${shape.y + (i + 1) * (shape.style.fontSize * 1.2)}" font-family="system-ui, sans-serif" font-size="${shape.style.fontSize}" fill="${shape.style.textColor}" text-anchor="${shape.style.textAlign}"${transform}>${escapeXML(line)}</text>`
      ).join('');
    }

    case 'sticky': {
      const text = (shape as any).text || '';
      const bg = shape.style.backgroundColor;
      let svg = `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="${bg}" stroke="rgba(0,0,0,0.1)" stroke-width="1"${transform}/>`;
      if (text) {
        const padding = 10;
        const lines = text.split(' ').reduce((acc: string[], word: string) => {
          const last = acc[acc.length - 1] || '';
          const test = last ? last + ' ' + word : word;
          if (test.length > 15 && last) {
            acc.push(word);
          } else if (last) {
            acc[acc.length - 1] = test;
          } else {
            acc.push(word);
          }
          return acc;
        }, []);
        for (let i = 0; i < lines.length; i++) {
          svg += `<text x="${shape.x + padding}" y="${shape.y + padding + (i + 1) * (shape.style.fontSize * 1.2)}" font-family="system-ui, sans-serif" font-size="${shape.style.fontSize}" fill="#1e1e1e"${transform}>${escapeXML(lines[i])}</text>`;
        }
      }
      return svg;
    }

    case 'image': {
      const imgShape = shape as any;
      if (imgShape.src) {
        return `<image x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" href="${imgShape.src}"${transform}/>`;
      }
      return '';
    }

    default:
      return '';
  }
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
