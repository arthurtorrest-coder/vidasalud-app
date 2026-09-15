import LegalPage, { LegalSection } from '../../components/legal/LegalPage'

export default function Terminos() {
  return (
    <LegalPage title="Términos y Condiciones" updatedLabel="Última actualización: 15 de septiembre de 2026">

      <LegalSection title="1. Aceptación de los términos">
        <p>
          VIDASALUD (en adelante, "la Plataforma", "nosotros") es un servicio de telemedicina operado
          en Perú bajo el RUC 20616174984, con domicilio en Carhuaz, Ancash, Perú. Al crear una cuenta,
          acceder o usar la Plataforma (sitio web, aplicación web y servicios asociados), usted
          ("el Usuario", "el Paciente") acepta íntegramente estos Términos y Condiciones. Si no está
          de acuerdo, no debe utilizar la Plataforma.
        </p>
      </LegalSection>

      <LegalSection title="2. Naturaleza del servicio">
        <p>
          VIDASALUD es un intermediario tecnológico que conecta a pacientes con médicos y otros
          profesionales de la salud colegiados (Colegio Médico del Perú — CMP, o Colegio de
          Psicólogos del Perú — CPsP) para la prestación de consultas de telemedicina por
          videollamada, conforme a la Ley N.º 30421 (Ley de telesalud) y su reglamento.
        </p>
        <p>
          <strong>La Plataforma no sustituye la atención médica presencial de emergencia.</strong> Ante
          una emergencia médica (dolor torácico, dificultad respiratoria severa, pérdida de
          conciencia, traumatismo grave, sangrado abundante, entre otros), el Usuario debe acudir de
          inmediato al servicio de emergencias más cercano o llamar a la línea de emergencias (106 /
          SAMU). VIDASALUD no presta servicios de atención de urgencias ni reemplaza los protocolos
          de emergencia del sistema de salud.
        </p>
      </LegalSection>

      <LegalSection title="3. Registro y cuenta de usuario">
        <ul>
          <li>Para reservar una consulta, el Usuario debe registrarse con nombre completo, DNI, teléfono y correo electrónico verídicos.</li>
          <li>El Usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de toda actividad realizada desde su cuenta.</li>
          <li>El Usuario declara ser mayor de edad o, en caso de registrar a un menor de edad o persona bajo su cuidado, contar con la representación legal correspondiente.</li>
          <li>VIDASALUD puede suspender o cancelar cuentas que proporcionen información falsa o hagan un uso indebido de la Plataforma.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Precios y forma de pago">
        <p>
          Los precios de las consultas se muestran en soles (S/.) antes de confirmar cada reserva e
          incluyen la videoconsulta, el diagnóstico y, cuando corresponda, la receta electrónica. La
          consulta de Medicina General tiene un precio de <strong>S/. 30</strong>; otras especialidades
          tienen precios propios indicados en la Plataforma.
        </p>
        <p>
          Los pagos se procesan a través de la pasarela de pagos Culqi, mediante tarjeta de
          débito/crédito, Yape o Plin. VIDASALUD no almacena los datos completos de tarjetas de
          pago; dicha información es procesada directamente por el operador de la pasarela de pagos
          bajo los estándares de seguridad PCI-DSS.
        </p>
        <p>
          La cita queda confirmada una vez que el pago es aprobado. En caso de rechazo o error en el
          pago, la reserva no se concreta y no se genera cargo alguno.
        </p>
      </LegalSection>

      <LegalSection title="5. Cancelaciones y reembolsos">
        <ul>
          <li>El Usuario puede cancelar una consulta antes de que el médico inicie la videollamada, sujeto a las condiciones mostradas al momento de la reserva.</li>
          <li>Si la consulta no se realiza por causas atribuibles a la Plataforma o al médico asignado (por ejemplo, el médico no se conecta), el monto pagado será reembolsado íntegramente o reprogramado, a elección del paciente.</li>
          <li>Si el paciente no se conecta a la videollamada dentro de un tiempo razonable luego de que el médico la inicie, la consulta podrá considerarse como no efectuada sin derecho a reembolso automático; el Usuario puede solicitar la revisión de su caso escribiendo a los canales de contacto indicados en la sección 12.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Médicos y verificación profesional">
        <p>
          Todos los médicos y psicólogos que prestan servicios a través de VIDASALUD cuentan con
          colegiatura vigente (CMP o CPsP), verificada por el equipo de VIDASALUD antes de habilitar
          su cuenta. La relación profesional-paciente se establece directamente entre el médico y el
          Usuario; VIDASALUD facilita el medio tecnológico para dicha atención, pero no práctica la
          medicina ni interviene en el criterio clínico del profesional tratante.
        </p>
      </LegalSection>

      <LegalSection title="7. Receta electrónica">
        <p>
          Cuando el profesional tratante lo determine necesario, se emitirá una receta electrónica
          con validez legal en farmacias y boticas de todo el Perú, conforme a la Ley N.º 30421 y su
          reglamento. La receta electrónica es de uso personal e intransferible del paciente
          atendido.
        </p>
      </LegalSection>

      <LegalSection title="8. Obligaciones del usuario">
        <ul>
          <li>Brindar información veraz sobre su identidad, síntomas y antecedentes médicos relevantes.</li>
          <li>Contar con conexión a internet, cámara y micrófono funcionales al momento de la cita.</li>
          <li>Usar la Plataforma únicamente para fines lícitos y personales, absteniéndose de grabar, difundir o reproducir la consulta sin autorización del profesional tratante.</li>
          <li>No suplantar la identidad de terceros al reservar o realizar una consulta.</li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Limitación de responsabilidad">
        <p>
          VIDASALUD pone a disposición la infraestructura tecnológica para la telemedicina, pero no
          es responsable por: (i) fallas de conectividad ajenas a la Plataforma; (ii) decisiones
          clínicas tomadas por el profesional tratante en ejercicio de su criterio médico
          independiente; (iii) el uso indebido que el Usuario haga de la receta electrónica o de las
          indicaciones médicas recibidas. Nada en estos Términos limita la responsabilidad que, por
          ley, corresponda directamente al profesional de la salud tratante.
        </p>
      </LegalSection>

      <LegalSection title="10. Propiedad intelectual">
        <p>
          El nombre "VIDASALUD", su logotipo, diseño, software y contenidos son propiedad de
          VIDASALUD o de sus licenciantes. Queda prohibida su reproducción, distribución o uso
          comercial sin autorización previa por escrito.
        </p>
      </LegalSection>

      <LegalSection title="11. Protección de datos personales">
        <p>
          El tratamiento de los datos personales y datos sensibles de salud del Usuario se rige por
          nuestra <a href="/privacidad" style={{ color: '#047857', fontWeight: 700 }}>Política de Privacidad</a>,
          elaborada conforme a la Ley N.º 29733 — Ley de Protección de Datos Personales y su
          reglamento.
        </p>
      </LegalSection>

      <LegalSection title="12. Modificaciones">
        <p>
          VIDASALUD podrá actualizar estos Términos y Condiciones en cualquier momento. Los cambios
          entrarán en vigencia desde su publicación en esta misma página, indicando la fecha de
          última actualización. El uso continuado de la Plataforma tras dichos cambios implica su
          aceptación.
        </p>
      </LegalSection>

      <LegalSection title="13. Ley aplicable y jurisdicción">
        <p>
          Estos Términos se rigen por las leyes de la República del Perú. Cualquier controversia se
          someterá a los jueces y tribunales competentes del distrito judicial de Áncash, sin
          perjuicio de los mecanismos de protección al consumidor ante INDECOPI.
        </p>
      </LegalSection>

      <LegalSection title="14. Contacto">
        <p>
          Para consultas sobre estos Términos y Condiciones, puede escribirnos a{' '}
          <a href="mailto:clinicavidasaludintegral@gmail.com" style={{ color: '#047857', fontWeight: 700 }}>
            clinicavidasaludintegral@gmail.com
          </a>{' '}
          o llamar al +51 991 297 354.
        </p>
      </LegalSection>

    </LegalPage>
  )
}
