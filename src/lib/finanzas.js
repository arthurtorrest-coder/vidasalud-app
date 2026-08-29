/* ─────────────────────────────────────────────────────────────
   VIDASALUD — Modelo financiero compartido
   Medicina General S/. 31 total: médico S/.15 fijo + margen S/.16
   Especialistas: precio neto médico + margen S/.16
   El margen (16) se reparte entre clínica / botica / coordinador
   según si la consulta llegó referida por una botica y si esa
   botica tiene un coordinador de zona asignado.
───────────────────────────────────────────────────────────── */

export const TARIFA_GENERAL       = 15   // médico de medicina general: pago fijo
export const MARGEN_TOTAL         = 16   // margen total sobre el pago al médico
export const COMISION_BOTICA      = 4    // botica, cuando refiere al paciente
export const COMISION_COORDINADOR = 2    // coordinador, cuando su botica refiere

export function esGeneralista(especialidad) {
  return (especialidad ?? '').toLowerCase().includes('general')
}

// Pago al médico por una consulta completada.
// Medicina General: S/. 15 fijo. Especialista: su precio neto configurado.
export function pagoMedico({ esGeneral, precioNeto }) {
  return esGeneral ? TARIFA_GENERAL : (Number(precioNeto) || 0)
}

// Reparto del margen (S/. 16) entre clínica, botica y coordinador.
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

// Precio total que paga el paciente: pago al médico + margen completo (S/. 16).
// El margen total no cambia con botica/coordinador — solo cambia cómo se
// reparte internamente (ver repartoMargen) — por eso aquí siempre se suma
// MARGEN_TOTAL completo, sin importar si la consulta viene referida.
export function precioTotalPaciente({ especialidad, precioMedico }) {
  const esGeneral = esGeneralista(especialidad)
  return pagoMedico({ esGeneral, precioNeto: precioMedico }) + MARGEN_TOTAL
}
