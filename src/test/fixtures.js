// Respuestas del backend con la forma del contrato (docs/architecture/api.md del backend).

export const PRODUCTS = [
  {
    id: 1,
    code: 'JERSEY-PRO',
    name: 'Jersey Pro',
    series: [
      {
        id: 1,
        measure: 'PRODUCCION',
        periodicity: 'MENSUAL',
        unit: 'unidades',
        firstPeriod: '2026-04',
        lastPeriod: '2026-07',
        observations: 4,
        dataVersion: 3,
      },
    ],
  },
  {
    id: 2,
    code: 'SHORT-RUN',
    name: 'Short Run',
    series: [
      {
        id: 2,
        measure: 'PRODUCCION',
        periodicity: 'MENSUAL',
        unit: 'unidades',
        firstPeriod: null,
        lastPeriod: null,
        observations: 0,
        dataVersion: null,
      },
    ],
  },
];

export const OBSERVATIONS = {
  seriesId: 1,
  productCode: 'JERSEY-PRO',
  productName: 'Jersey Pro',
  measure: 'PRODUCCION',
  periodicity: 'MENSUAL',
  unit: 'unidades',
  dataVersion: 3,
  observations: [
    { period: '2026-04', value: 100 },
    { period: '2026-05', value: 110 },
    { period: '2026-06', value: 120 },
    { period: '2026-07', value: 130 },
  ],
};

export const EXECUTIONS = [
  {
    id: 7,
    seriesId: 1,
    productName: 'Jersey Pro',
    executedAt: '2026-11-05T15:00:00Z',
    executedBy: 2,
    dataVersion: 3,
    evaluationStart: '2026-05',
    methods: ['SIMPLE_MOVING_AVERAGE', 'EXPONENTIAL_SMOOTHING'],
  },
];

export const DETAIL = {
  id: 7,
  seriesId: 1,
  productCode: 'JERSEY-PRO',
  productName: 'Jersey Pro',
  measure: 'PRODUCCION',
  unit: 'unidades',
  dataVersion: 3,
  executedAt: '2026-11-05T15:00:00Z',
  executedBy: 2,
  executedByUsername: 'admin',
  periodFrom: '2026-04',
  periodTo: '2026-07',
  calculationVersion: '1.0',
  evaluationStart: '2026-05',
  actuals: OBSERVATIONS.observations,
  methods: [
    {
      method: 'SIMPLE_MOVING_AVERAGE',
      periods: 1,
      weights: [],
      alpha: null,
      beta: null,
      forecasts: [
        { period: '2026-05', forecast: 100, actual: 110 },
        { period: '2026-06', forecast: 110, actual: 120 },
        { period: '2026-07', forecast: 120, actual: 130 },
      ],
      nextForecast: { period: '2026-08', forecast: 130, actual: null },
      mad: 10,
      mapePercent: 8.3721,
      pairsUsed: 3,
      mapeExcluded: 0,
    },
    {
      method: 'EXPONENTIAL_SMOOTHING',
      periods: null,
      weights: [],
      alpha: 0.0025,
      beta: null,
      forecasts: [
        { period: '2026-05', forecast: 100, actual: 110 },
        { period: '2026-06', forecast: 105, actual: 120 },
        { period: '2026-07', forecast: 112.5, actual: 130 },
      ],
      nextForecast: { period: '2026-08', forecast: 121.25, actual: null },
      mad: 14.1667,
      mapePercent: 11.6833,
      pairsUsed: 3,
      mapeExcluded: 1,
    },
  ],
};

export const COMPARISON = {
  executionId: 7,
  seriesId: 1,
  evaluationFrom: '2026-05',
  evaluationTo: '2026-07',
  mapeThresholdPercent: 10,
  bestByMad: ['SIMPLE_MOVING_AVERAGE'],
  bestByMape: ['SIMPLE_MOVING_AVERAGE'],
  methods: [
    {
      method: 'SIMPLE_MOVING_AVERAGE',
      mad: 10,
      mapePercent: 8.3721,
      pairsUsed: 3,
      mapeExcluded: 0,
      bestByMad: true,
      bestByMape: true,
      status: 'CUMPLE',
    },
    {
      method: 'EXPONENTIAL_SMOOTHING',
      mad: 14.1667,
      mapePercent: 11.6833,
      pairsUsed: 3,
      mapeExcluded: 1,
      bestByMad: false,
      bestByMape: false,
      status: 'NO_CUMPLE',
    },
  ],
};

/** Atiende las consultas de lectura de históricos, pronósticos e indicadores. */
export function fixtures(req) {
  if (req.method !== 'GET') return undefined;
  if (req.url === '/api/v1/history/products') return { status: 200, data: PRODUCTS };
  if (req.url === '/api/v1/history/series/1/observations') return { status: 200, data: OBSERVATIONS };
  if (req.url === '/api/v1/forecasts') return { status: 200, data: EXECUTIONS };
  if (req.url === '/api/v1/forecasts/7') return { status: 200, data: DETAIL };
  if (req.url === '/api/v1/indicators/executions/7') return { status: 200, data: COMPARISON };
  return undefined;
}
