/**
 * Inline SVG icon set — one tiny component instead of an icon dependency.
 * All icons are 24×24 stroke glyphs inheriting `currentColor`.
 */

export type IconName =
  | 'cart'
  | 'store'
  | 'box'
  | 'chart'
  | 'route'
  | 'refresh'
  | 'search'
  | 'bolt'
  | 'clock'
  | 'check'
  | 'x'
  | 'plus'
  | 'minus'
  | 'info'
  | 'alert'
  | 'pin'
  | 'list'
  | 'spark'
  | 'chevron-left'
  | 'chevron-right'
  | 'trash';

const PATHS: Record<IconName, string> = {
  cart: 'M4 5h2l2.4 10.2a1.6 1.6 0 0 0 1.6 1.3h6.9a1.6 1.6 0 0 0 1.6-1.2L20 8H7M10 20.2a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0Zm7.5 0a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0Z',
  store: 'M4 9.5 5.2 5h13.6L20 9.5M4 9.5a2.3 2.3 0 0 0 4 1.5 2.3 2.3 0 0 0 4 0 2.3 2.3 0 0 0 4 0 2.3 2.3 0 0 0 4-1.5M5.5 12v7h13v-7M10 19v-4h4v4',
  box: 'M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4',
  chart: 'M4 20V4m0 16h16M8 16v-5m4 5V8m4 8v-3',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
  refresh: 'M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm9.5 3-4.9-4.9',
  bolt: 'M13 3 5 13h5l-1 8 8-10h-5l1-8Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
  check: 'M5 12.5 10 17.5 19 7',
  x: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5m0-8.5v.5',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v4m0 3v.5',
  pin: 'M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.6 12 21 12 21Zm0-8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.5M4 12h.5M4 18h.5',
  spark: 'M12 3v4m0 10v4m9-9h-4M7 12H3m14.5-6.5-2.8 2.8M9.3 14.7l-2.8 2.8m0-11 2.8 2.8m5.4 5.4 2.8 2.8',
  'chevron-left': 'M15 5l-7 7 7 7',
  'chevron-right': 'M9 5l7 7-7 7',
  trash: 'M5 7h14m-9-3h4M8 7l.7 12.2a1.6 1.6 0 0 0 1.6 1.5h3.4a1.6 1.6 0 0 0 1.6-1.5L16 7m-6 3.5v6m4-6v6',
};

interface Props {
  name: IconName;
  className?: string;
}

export function Icon({ name, className = 'h-4 w-4' }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
