export const UNDER_CONSTRUCTION_MESSAGE =
  'Módulo en construcción: pendiente de validación con Ingeniería Industrial';

export default function UnderConstruction() {
  return (
    <div className="construction" role="status">
      <span className="construction__icon" aria-hidden="true">⚙</span>
      <p>{UNDER_CONSTRUCTION_MESSAGE}</p>
    </div>
  );
}
