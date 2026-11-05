import { MEASURE_LABELS } from '../format';

/** Aplana los productos de /history/products en una opción por serie, con un nombre para mostrar. */
export function seriesOptions(products) {
  return products.flatMap((product) =>
    product.series.map((series) => ({
      ...series,
      seriesId: series.id,
      productCode: product.code,
      productName: product.name,
      label:
        product.series.length > 1
          ? `${product.name} (${(MEASURE_LABELS[series.measure] ?? series.measure).toLowerCase()})`
          : product.name,
    })),
  );
}
