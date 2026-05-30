/* ─────────────────────────────────────────────────────────────
   VIDASALUD — Design tokens compartidos
   Importar con: import { C, R, T, S } from '../../lib/tokens'
───────────────────────────────────────────────────────────── */

/* ── Colores ───────────────────────────────────────────────── */
export const C = {
  // Verde — paleta principal de marca
  green50:  '#ECFDF5',
  green100: '#D1FAE5',
  green200: '#A7F3D0',
  green300: '#6EE7B7',
  green400: '#34D399',
  green500: '#10B981',
  green600: '#059669',
  green700: '#047857',
  green800: '#065F46',
  green900: '#064E3B',

  // Grises neutros
  gray50:  '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Ámbar — estados de alerta y disponibilidad próxima
  amber:     '#F59E0B',
  amberBg:   '#FFFBEB',
  amberText: '#B45309',

  // Rojo — errores, cancelaciones
  red:    '#EF4444',
  red600: '#DC2626',
  red50:  '#FEF2F2',
  redBg:  '#FEF2F2',   // alias de red50

  // Azul — información, documentos clínicos
  blue600:  '#2563EB',
  blueBg:   '#EFF6FF',
  blueText: '#1D4ED8',

  // Pagos peruanos
  yape:   '#6D28D9',   // Yape morado
  yapeBg: '#F5F3FF',
  plin:   '#0EA5E9',   // Plin azul cielo
  plinBg: '#E0F2FE',

  // Base
  white: '#FFFFFF',
}

/* ── Border-radius (px) ────────────────────────────────────── */
export const R = {
  card:   16,
  button: 12,
  chip:   10,
  input:  12,
  modal:  20,
  pill:   24,
}

/* ── Tipografía — fontSize en px ───────────────────────────── */
export const T = {
  xs:      11,
  sm:      12,
  base:    13,
  md:      14,
  lg:      16,
  xl:      18,
  xxl:     20,
  display: 24,
}

/* ── Sombras ───────────────────────────────────────────────── */
export const S = {
  // Neutrales
  sm: '0 1px 4px rgba(0,0,0,0.08)',
  md: '0 4px 14px rgba(0,0,0,0.10)',
  lg: '0 8px 28px rgba(0,0,0,0.13)',

  // Variantes verdes para botones y elementos de acción
  greenSm: '0 2px 8px rgba(5,150,105,0.20)',
  greenMd: '0 4px 16px rgba(5,150,105,0.30)',
  greenLg: '0 8px 28px rgba(5,150,105,0.38)',
}
