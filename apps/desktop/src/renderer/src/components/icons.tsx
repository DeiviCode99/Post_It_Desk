/** Iconos SVG en línea: heredan el color del texto y no dependen de fuentes externas. */
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;
const stroke = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const PinIcon = ({ filled }: { filled: boolean }) => (
  <svg {...base}>
    <path {...stroke} fill={filled ? 'currentColor' : 'none'} d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
    <path {...stroke} d="M12 14v6" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base}>
    <path {...stroke} d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const PlusIcon = () => (
  <svg {...base}>
    <path {...stroke} d="M12 5v14M5 12h14" />
  </svg>
);

export const SearchIcon = () => (
  <svg {...base} width={16} height={16}>
    <circle {...stroke} cx="11" cy="11" r="6" />
    <path {...stroke} d="m16 16 4 4" />
  </svg>
);

export const CheckIcon = () => (
  <svg {...base} width={14} height={14}>
    <path {...stroke} strokeWidth={3} d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
