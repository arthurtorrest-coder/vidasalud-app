/* ─────────────────────────────────────────────────────────────
   VIDASALUD — Modelo financiero compartido
   Medicina General S/. 30 total: médico S/.15 fijo + margen S/.15
   Especialistas: precio neto médico + margen S/.15
   El margen (15) se reparte entre clínica / botica / coordinador
   según si la consulta llegó referida por una botica y si esa
   botica tiene un coordinador de zona asignado.

   Los valores de abajo son "live bindings" (export let, no const):
   arrancan con estos defaults y se sobrescriben con lo que haya en
   la tabla Supabase `configuracion_precios` — ver cargarConfiguracionPrecios()
   y suscribirConfiguracionPrecios(), llamadas una vez desde App.jsx.
   Como son bindings de ES modules, cualquier archivo que las importe
   (`import { COMISION_BOTICA } from '../../lib/finanzas'`) ve el valor
   actualizado automáticamente sin tocar el código de esos archivos.
───────────────────────────────────────────────────────────── */

import { supabase } from './supabase'

export let TARIFA_GENERAL       = 15   // médico de medicina general: pago fijo
export let MARGEN_TOTAL         = 15   // margen total sobre el pago al médico
export let COMISION_BOTICA      = 4    // botica, cuando refiere al paciente
export let COMISION_COORDINADOR = 2    // coordinador, cuando su botica refiere

function aplicarConfig(row) {
  if (!row) return
  if (row.tarifa_general       != null) TARIFA_GENERAL       = Number(row.tarifa_general)
  if (row.margen_total         != null) MARGEN_TOTAL         = Number(row.margen_total)
  if (row.comision_botica      != null) COMISION_BOTICA      = Number(row.comision_botica)
  if (row.comision_coordinador != null) COMISION_COORDINADOR = Number(row.comision_coordinador)
}

// Carga inicial desde Supabase — llamar una vez al iniciar la app (App.jsx).
// Si falla (sin conexión, tabla no migrada aún, etc.) se mantienen los
// valores por defecto de arriba, para no romper el cálculo de precios.
export async function cargarConfiguracionPrecios() {
  const { data, error } = await supabase
    .from('configuracion_precios')
    .select('tarifa_general, margen_total, comision_botica, comision_coordinador')
    .eq('id', 1)
    .maybeSingle()
  if (error) {
    console.warn('[finanzas] No se pudo cargar configuracion_precios, usando valores por defecto:', error.message)
    return
  }
  aplicarConfig(data)
}

// Suscripción en tiempo real — cualquier cambio guardado desde AdminPrecios.jsx
// se refleja de inmediato en TARIFA_GENERAL/MARGEN_TOTAL/etc. para toda la
// sesión (ver nota de "live bindings" arriba). Llamar una vez en App.jsx.
export function suscribirConfiguracionPrecios() {
  return supabase
    .channel('configuracion-precios-global')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'configuracion_precios' },
      (payload) => aplicarConfig(payload.new)
    )
    .subscribe()
}

export function esGeneralista(especialidad) {
  return (especialidad ?? '').toLowerCase().includes('general')
}

// ─── Precios por especialidad (tabla especialidades_precios) ───────────────
// Caché en memoria — se llena con cargarEspecialidadesPrecios() y se
// mantiene al día con suscribirEspecialidadesPrecios(). Igual que la
// configuración general, esto se llama una vez desde App.jsx.
let especialidadesPreciosCache = {}   // { [especialidad en minúsculas]: fila }

function normalizarEspecialidad(especialidad) {
  return (especialidad ?? '').toLowerCase().trim()
}

export async function cargarEspecialidadesPrecios() {
  const { data, error } = await supabase
    .from('especialidades_precios')
    .select('especialidad, precio_medico, precio_total, activo')
  if (error) {
    console.warn('[finanzas] No se pudo cargar especialidades_precios:', error.message)
    return
  }
  especialidadesPreciosCache = Object.fromEntries(
    (data ?? []).map(row => [normalizarEspecialidad(row.especialidad), row])
  )
}

export function suscribirEspecialidadesPrecios() {
  return supabase
    .channel('especialidades-precios-global')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'especialidades_precios' },
      () => cargarEspecialidadesPrecios()   // cualquier cambio → recarga la tabla completa
    )
    .subscribe()
}

// Precio total configurado para una especialidad, o null si no está
// registrada en especialidades_precios o está desactivada (activo=false).
export function getPrecioEspecialidad(especialidad) {
  const row = especialidadesPreciosCache[normalizarEspecialidad(especialidad)]
  if (!row || row.activo === false) return null
  return Number(row.precio_total)
}

// Pago al médico por una consulta completada.
// Medicina General: pago fijo (TARIFA_GENERAL). Especialista: su precio neto configurado.
export function pagoMedico({ esGeneral, precioNeto }) {
  return esGeneral ? TARIFA_GENERAL : (Number(precioNeto) || 0)
}

// Reparto del margen entre clínica, botica y coordinador.
export function repartoMargen({ tieneBotica, tieneCoordinador }) {
  if (!tieneBotica) {
    return { botica: 0, coordinador: 0, clinica: MARGEN_TOTAL }
  }
  if (!tieneCoordinador) {
    return { botica: COMISION_BOTICA, coordinador: 0, clinica: MARGEN_TOTAL - COMISION_BOTICA }
  }
  return {
    botica:      COMISION_BOTICA,
    coordinador: COMISION_COORDINADOR,
    clinica:     MARGEN_TOTAL - COMISION_BOTICA - COMISION_COORDINADOR,
  }
}

// Reparto completo de una consulta: médico + margen (clínica/botica/coordinador).
export function repartoConsulta({ especialidad, precioNeto, tieneBotica, tieneCoordinador }) {
  const esGeneral = esGeneralista(especialidad)
  const medico    = pagoMedico({ esGeneral, precioNeto })
  const margen    = repartoMargen({ tieneBotica, tieneCoordinador })
  return { medico, ...margen }
}

// Precio total que paga el paciente: pago al médico + margen completo.
// El margen total no cambia con botica/coordinador — solo cambia cómo se
// reparte internamente (ver repartoMargen) — por eso aquí siempre se suma
// MARGEN_TOTAL completo, sin importar si la consulta viene referida.
export function precioTotalPaciente({ especialidad, precioMedico }) {
  const esGeneral = esGeneralista(especialidad)
  return pagoMedico({ esGeneral, precioNeto: precioMedico }) + MARGEN_TOTAL
}
