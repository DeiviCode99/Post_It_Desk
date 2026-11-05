import type { Priority } from '../types';

/** Cada prioridad tiene un color de post-it y un nombre; el nombre siempre acompaña al color. */
export const PRIORITIES: ReadonlyArray<{ value: Priority; label: string; short: string }> = [
  { value: 'high', label: 'Alta', short: 'Alta' },
  { value: 'medium', label: 'Media', short: 'Media' },
  { value: 'low', label: 'Baja', short: 'Baja' },
  { value: 'none', label: 'Sin prioridad', short: 'Ninguna' },
];

/** Colores sugeridos al crear etiquetas nuevas, en rotación. */
export const TAG_COLORS = ['#8EC5FF', '#C4A7FF', '#FFB38A', '#9FE2BF', '#FF8FB1', '#FFE066'];
