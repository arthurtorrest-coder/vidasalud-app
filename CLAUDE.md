# VIDASALUD — Clínica Virtual de Telemedicina

## Contexto del Proyecto

**VIDASALUD** es una plataforma de telemedicina para todo el Perú, desarrollada desde Huaraz, Ancash. Conecta pacientes con médicos colegiados para consultas en video en tiempo real, con pagos en soles y receta electrónica válida bajo la Ley 30421.

- **Mercado:** Perú (enfoque inicial en regiones con baja cobertura médica: sierra y selva)
- **Moneda:** Soles peruanos (S/.)
- **Regulación:** RENIPRESS, CMP (Colegio Médico del Perú), CPsP, receta electrónica Ley 30421
- **Dispositivos objetivo:** Mobile-first (app web progresiva, diseño 390px de ancho)

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + Vite 8 |
| Routing | React Router DOM v7 |
| Backend / Auth / DB | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Pagos | Culqi (gateway peruano, script CDN v4) |
| Videollamadas | Daily.co (`@daily-co/daily-react`) |
| Estado global | Zustand |
| Formularios | React Hook Form + Zod |
| Notificaciones | React Hot Toast |
| Iconos | Lucide React |
| Fechas / Horarios | date-fns |

## Arquitectura

```
src/
├── components/         # Componentes reutilizables (UI puro)
│   ├── ui/             # Avatar, Badge, Button, Card, Toast
│   └── layout/         # BottomNav, Header, PageShell
├── pages/              # Una carpeta por pantalla principal
│   ├── Home/           # Búsqueda de médicos, especialidades
│   ├── Booking/        # Selección de hora, resumen de cita
│   ├── Payment/        # Checkout Culqi
│   ├── Room/           # Videollamada Daily.co
│   ├── History/        # Historial clínico electrónico (HCE)
│   └── Profile/        # Perfil paciente / médico
├── hooks/              # useAuth, useAppointment, useRoom
├── lib/
│   ├── supabase.js     # Cliente Supabase (singleton)
│   └── daily.js        # Helpers Daily.co
├── stores/             # Zustand stores
└── utils/              # Formateo de precios, fechas, validación CMP
```

## Base de Datos Supabase (tablas principales)

- `profiles` — pacientes y médicos (rol: `patient` | `doctor`)
- `doctors` — CMP/CPsP, especialidad, tarifa, disponibilidad
- `appointments` — citas (estado: `pending` | `paid` | `active` | `done` | `cancelled`)
- `rooms` — tokens Daily.co por cita
- `prescriptions` — recetas electrónicas vinculadas a cita
- `payments` — registro de cobros Culqi (charge_id, monto, estado)

## Integración Culqi

Culqi no se instala por npm. Se carga como script en `index.html`:

```html
<script src="https://checkout.culqi.com/js/v4"></script>
```

El objeto global `Culqi` se usa en el componente `<PaymentPage>`. Las claves van en variables de entorno:

```
VITE_CULQI_PUBLIC_KEY=pk_live_...
```

El cargo se crea server-side vía Supabase Edge Function para no exponer la clave secreta.

## Integración Daily.co

Se usa `@daily-co/daily-react` (hooks) + `@daily-co/daily-js` (SDK base).

- Las salas se crean server-side (Supabase Edge Function) al confirmar el pago
- Los tokens de sala expiran al terminar la cita
- Componente `<VideoRoom>` maneja el ciclo completo: join → llamada → leave

## Variables de Entorno (`.env`)

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_CULQI_PUBLIC_KEY=pk_live_...
VITE_DAILY_DOMAIN=vidasalud.daily.co
```

Las claves secretas (Culqi secret, Daily API key) SOLO van en Supabase Edge Functions, nunca en el frontend.

## Convenciones de Código

- Componentes en PascalCase, archivos en `PascalCase.jsx`
- Hooks en `camelCase`, archivos en `useHook.js`
- Inline styles para componentes UI propios (consistente con prototipo)
- Sin comentarios innecesarios — nombres de variables son suficientes
- Precios siempre en céntimos (integer) internamente, formateados con `formatPrice()`
- Fechas/horas en UTC en DB, convertidas a `America/Lima` (UTC-5) en UI

## Contexto Peruano Importante

- Médicos se identifican con CMP (médicos) o CPsP (psicólogos)
- Precios típicos: Medicina general S/. 30–50, Especialidades S/. 50–120
- Promedio de consulta: 20 minutos
- Zonas sin conectividad estable → diseño offline-tolerante, carga progresiva
- Nomenclatura: "cita" (no "turno"), "médico" (no "doctor" en UI), "S/." (no "$")
