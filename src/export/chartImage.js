// Convierte la figura del gráfico (eje Y fijo + zona desplazable) en un SVG independiente, con los colores y
// fuentes ya resueltos (sin variables CSS), y de ahí en PNG. Exporta todos los meses, no solo los visibles.

const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-family', 'font-weight', 'opacity'];
const PADDING = 16;
const TITLE_H = 28;
const LEGEND_ROW_H = 20;

/** `figure` es el elemento que devuelve el ref de LineChart. Devuelve { svg, width, height }. */
export function chartToSvg(figure, { title } = {}) {
  if (!figure) throw new Error('Muestre al menos una serie en el gráfico para exportarlo.');
  const yAxis = figure.querySelector('.chart__y-axis');
  const plot = figure.querySelector('.chart__plot');
  const legend = [...figure.querySelectorAll('.chart__legend li')];
  const axisWidth = Number(yAxis.getAttribute('width'));
  const plotWidth = Number(plot.getAttribute('width'));
  const plotHeight = Number(plot.getAttribute('height'));
  const width = axisWidth + plotWidth + PADDING * 2;

  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('xmlns', SVG_NS);
  const ink = cssColor(figure, '--color-ink', '#111214');
  const font = getComputedStyle(figure).fontFamily || 'sans-serif';

  // Leyenda en filas: cada elemento ocupa el ancho de su texto.
  const items = legend.map((li) => ({ marker: li.querySelector('svg'), text: li.textContent.trim() }));
  const rows = [];
  let row = [];
  let rowWidth = 0;
  items.forEach((item) => {
    const itemWidth = 30 + item.text.length * 7 + 18;
    if (row.length > 0 && rowWidth + itemWidth > width - PADDING * 2) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    row.push({ ...item, x: rowWidth });
    rowWidth += itemWidth;
  });
  if (row.length > 0) rows.push(row);

  const plotTop = PADDING + TITLE_H + rows.length * LEGEND_ROW_H + 8;
  const height = plotTop + plotHeight + PADDING;
  root.setAttribute('width', width);
  root.setAttribute('height', height);
  root.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const background = document.createElementNS(SVG_NS, 'rect');
  Object.entries({ width, height, fill: '#ffffff' }).forEach(([k, v]) => background.setAttribute(k, v));
  root.appendChild(background);

  const heading = text(title ?? figure.querySelector('.chart__title')?.textContent ?? '', PADDING, PADDING + 16, {
    fill: ink,
    'font-family': font,
    'font-size': 15,
    'font-weight': 600,
  });
  root.appendChild(heading);

  rows.forEach((items, r) => {
    const y = PADDING + TITLE_H + r * LEGEND_ROW_H;
    items.forEach((item) => {
      const marker = inlineClone(item.marker);
      marker.setAttribute('x', PADDING + item.x);
      marker.setAttribute('y', y);
      root.appendChild(marker);
      root.appendChild(text(item.text, PADDING + item.x + 28, y + 9, { fill: ink, 'font-family': font, 'font-size': 12 }));
    });
  });

  const axis = inlineClone(yAxis);
  axis.setAttribute('x', PADDING);
  axis.setAttribute('y', plotTop);
  root.appendChild(axis);
  const chart = inlineClone(plot);
  chart.setAttribute('x', PADDING + axisWidth);
  chart.setAttribute('y', plotTop);
  ['role', 'tabindex', 'aria-labelledby', 'aria-describedby', 'class'].forEach((name) => chart.removeAttribute(name));
  // La guía del mouse no va en la imagen.
  chart.querySelectorAll('.chart__crosshair, .chart__dot').forEach((node) => node.remove());
  root.appendChild(chart);

  return { svg: new XMLSerializer().serializeToString(root), width, height };
}

/** PNG a escala 2 para que se vea nítido en documentos. Devuelve un Blob. */
export async function svgToPng({ svg, width, height }, scale = 2) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo dibujar el gráfico.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen.'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Copia el nodo y fija en cada elemento los estilos calculados (colores de variables CSS incluidos). */
function inlineClone(source) {
  const clone = source.cloneNode(true);
  const originals = [source, ...source.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  originals.forEach((original, i) => {
    const computed = getComputedStyle(original);
    const style = STYLE_PROPS.map((prop) => [prop, computed.getPropertyValue(prop)])
      .filter(([, value]) => value && value !== 'normal')
      .map(([prop, value]) => `${prop}:${value}`)
      .join(';');
    if (style) copies[i].setAttribute('style', style);
    copies[i].removeAttribute('class');
  });
  return clone;
}

function text(content, x, y, attributes) {
  const node = document.createElementNS(SVG_NS, 'text');
  node.setAttribute('x', x);
  node.setAttribute('y', y);
  Object.entries(attributes).forEach(([k, v]) => node.setAttribute(k, v));
  node.textContent = content;
  return node;
}

function cssColor(element, variable, fallback) {
  return getComputedStyle(element).getPropertyValue(variable).trim() || fallback;
}
