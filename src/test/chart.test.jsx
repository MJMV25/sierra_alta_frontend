import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LineChart from '../components/LineChart';

/** Meses consecutivos desde enero de 2022. */
function months(count) {
  return Array.from({ length: count }, (_, i) => {
    const year = 2022 + Math.floor(i / 12);
    return `${year}-${String((i % 12) + 1).padStart(2, '0')}`;
  });
}

const serie = (count, label = 'Producción real') => ({
  key: label,
  label,
  color: '#111214',
  values: Array.from({ length: count }, (_, i) => 100 + i),
});

describe('LineChart', () => {
  it('con muchos meses se desplaza en horizontal y avisa cómo ver todos', () => {
    const { container } = render(<LineChart title="Producción" periods={months(57)} series={[serie(57)]} />);
    const svg = screen.getByRole('img', { name: 'Producción' });
    // 34 px por mes como mínimo: más ancho que el contenedor (720 px sin ResizeObserver).
    expect(Number(svg.getAttribute('width'))).toBeGreaterThan(1800);
    expect(screen.getByText(/57 meses: desplace el gráfico/)).toBeInTheDocument();
    // El eje Y va en su propio SVG, fuera de la zona que se desplaza.
    expect(container.querySelector('.chart__y-axis')).not.toBeNull();
    expect(container.querySelector('.chart__scroll .chart__y-axis')).toBeNull();
  });

  it('las etiquetas del eje X quedan separadas y el año aparece en enero', () => {
    const { container } = render(<LineChart title="Producción" periods={months(57)} series={[serie(57)]} />);
    const labels = [...container.querySelectorAll('.chart__scroll text.chart__axis')];
    const xs = labels.map((label) => Number(label.getAttribute('x')));
    const gaps = xs.slice(1).map((x, i) => x - xs[i]).slice(0, -1);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(46);
    const years = [...container.querySelectorAll('.chart__axis-year')].map((year) => year.textContent);
    expect(years).toEqual(expect.arrayContaining(['2022', '2023', '2024', '2025', '2026']));
  });

  it('con pocos meses ocupa el ancho disponible sin desplazamiento', () => {
    render(<LineChart title="Producción" periods={months(4)} series={[serie(4)]} />);
    expect(Number(screen.getByRole('img').getAttribute('width'))).toBe(720);
    expect(screen.queryByText(/desplace el gráfico/)).not.toBeInTheDocument();
  });

  it('con el teclado muestra los valores del mes y vacío donde no hay pronóstico', () => {
    const forecast = { key: 'sma', label: 'Prom. simple', color: '#2a78d6', values: [null, 100, 110, 120] };
    render(<LineChart title="Producción" periods={months(4)} series={[serie(4), forecast]} />);
    const svg = screen.getByRole('img');

    fireEvent.keyDown(svg, { key: 'End' });
    expect(screen.getByRole('status')).toHaveTextContent('abr de 2022');
    fireEvent.keyDown(svg, { key: 'Home' });
    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('ene de 2022');
    expect(tooltip).toHaveTextContent('Prom. simple—');
  });

  it('funciona con un solo mes y con una serie sin valores', () => {
    const empty = { key: 'vacia', label: 'Sin datos', color: '#2a78d6', values: [null] };
    render(<LineChart title="Producción" periods={months(1)} series={[serie(1), empty]} />);
    const svg = screen.getByRole('img');
    expect(svg.querySelectorAll('path')[1].getAttribute('d')).toBe('');
    fireEvent.keyDown(svg, { key: 'ArrowLeft' });
    expect(screen.getByRole('status')).toHaveTextContent('ene de 2022');
  });
});
