import LegalPage, { LegalSection } from '../../components/legal/LegalPage'

const C = { green700: '#047857', green50: '#ECFDF5', green200: '#A7F3D0', red600: '#DC2626', red50: '#FEF2F2', red200: '#FECACA' }

function ReglaCard({ icon, title, desc, bg, border, color }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: bg, border: `1.5px solid ${border}`,
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  )
}

export default function Devoluciones() {
  return (
    <LegalPage title="Política de Devoluciones y Reembolsos" updatedLabel="Última actualización: 16 de septiembre de 2026">

      <LegalSection title="1. Resumen de la política">
        <p>
          En VIDASALUD el reembolso de una consulta pagada depende del momento en que se cancela y
          de si la consulta llegó a realizarse. Estas son las tres reglas que aplicamos siempre:
        </p>

        <ReglaCard
          icon="✅" color={C.green700} bg={C.green50} border={C.green200}
          title="Cancelación con más de 24 horas de anticipación → Reembolso completo"
          desc="Si cancelas tu cita programada con al menos 24 horas de anticipación a la hora reservada, te devolvemos el 100% del monto pagado."
        />
        <ReglaCard
          icon="⚠️" color={C.red600} bg={C.red50} border={C.red200}
          title="Cancelación con menos de 24 horas de anticipación → Sin reembolso"
          desc="Si cancelas o no te presentas a la videollamada faltando menos de 24 horas para la cita, no corresponde reembolso, ya que el médico reservó ese horario específicamente para ti."
        />
        <ReglaCard
          icon="🛠️" color={C.green700} bg={C.green50} border={C.green200}
          title="Problemas técnicos de la Plataforma → Reembolso completo"
          desc="Si la consulta no pudo realizarse por una falla de la Plataforma (la videollamada no conecta, el médico no se presenta, error de pago duplicado, etc.), te devolvemos el 100% del monto, sin excepción."
        />
      </LegalSection>

      <LegalSection title="2. Turnos de guardia (atención inmediata)">
        <p>
          Los turnos de guardia (Medicina General, atención inmediata) se pagan una vez que un médico
          ya tomó el turno y está disponible para atenderte. Si tras el pago el médico asignado no
          inicia la videollamada dentro de un tiempo razonable, se aplica la regla de "problemas
          técnicos" de la sección 1: reembolso completo.
        </p>
      </LegalSection>

      <LegalSection title="3. Cómo se calcula el plazo de 24 horas">
        <p>
          El plazo se calcula desde el momento en que solicitas la cancelación hasta la hora exacta
          programada de tu cita (hora Lima, UTC-5). Por ejemplo, si tu cita es a las 3:00 pm del
          jueves, debes cancelarla antes de las 3:00 pm del miércoles para acceder al reembolso
          completo.
        </p>
      </LegalSection>

      <LegalSection title="4. Cómo solicitar un reembolso">
        <p>
          Para solicitar la cancelación de una cita o reportar un problema técnico:
        </p>
        <ol>
          <li>Si aún no se realizó la consulta, cancélala directamente desde la sección "Mis citas" en la app (cuando aplique).</li>
          <li>Si ya se realizó el cargo y necesitas ayuda, escríbenos a{' '}
            <a href="mailto:clinicavidasaludintegral@gmail.com" style={{ color: C.green700, fontWeight: 700 }}>
              clinicavidasaludintegral@gmail.com
            </a>{' '}o al +51 991 297 354, indicando tu nombre, el correo de tu cuenta y la fecha/hora de la cita.
          </li>
          <li>
            También puedes registrar tu caso en nuestro{' '}
            <a href="/reclamaciones" style={{ color: C.green700, fontWeight: 700 }}>Libro de Reclamaciones</a>{' '}
            si consideras que tu solicitud no fue atendida correctamente.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="5. Plazo de devolución del dinero">
        <p>
          Una vez aprobado el reembolso, el monto se devuelve al mismo medio de pago utilizado
          (tarjeta, Yape o Plin) a través de nuestra pasarela de pagos Culqi. El tiempo de acreditación
          depende de la entidad financiera del Usuario y, en la mayoría de los casos, se refleja en un
          plazo de 3 a 10 días hábiles.
        </p>
      </LegalSection>

      <LegalSection title="6. Contacto">
        <p>
          Ante cualquier duda sobre esta política, contáctanos a{' '}
          <a href="mailto:clinicavidasaludintegral@gmail.com" style={{ color: C.green700, fontWeight: 700 }}>
            clinicavidasaludintegral@gmail.com
          </a>{' '}o al +51 991 297 354.
        </p>
      </LegalSection>

    </LegalPage>
  )
}
