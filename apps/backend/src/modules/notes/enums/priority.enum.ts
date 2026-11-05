/** Prioridad de una nota. En la interfaz se traduce al color del post-it. */
export enum Priority {
  None = 'none',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

/** Peso numérico para ordenar: mayor número, más arriba en la lista. */
export const PRIORITY_WEIGHT: Record<Priority, number> = {
  [Priority.High]: 3,
  [Priority.Medium]: 2,
  [Priority.Low]: 1,
  [Priority.None]: 0,
};
