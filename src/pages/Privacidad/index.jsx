import LegalPage, { LegalSection } from '../../components/legal/LegalPage'

export default function Privacidad() {
  return (
    <LegalPage title="Política de Privacidad" updatedLabel="Última actualización: 15 de septiembre de 2026">

      <LegalSection title="1. Responsable del tratamiento">
        <p>
          VIDASALUD, identificada con RUC 20616174984 y domicilio en Carhuaz, Ancash, Perú, es la
          responsable del tratamiento de los datos personales recopilados a través de la plataforma
          web y aplicación VIDASALUD (en adelante, "la Plataforma"), conforme a la Ley N.º 29733 —
          Ley de Protección de Datos Personales — y su Reglamento, aprobado por Decreto Supremo
          N.º 003-2013-JUS.
        </p>
      </LegalSection>

      <LegalSection title="2. Datos personales que recopilamos">
        <ul>
          <li><strong>Datos de identificación:</strong> nombre completo, DNI, fecha de nacimiento, teléfono y correo electrónico.</li>
          <li><strong>Datos de salud (categoría sensible):</strong> motivo de consulta, síntomas, diagnóstico, indicaciones médicas, recetas electrónicas e historial de consultas.</li>
          <li><strong>Datos de la videoconsulta:</strong> registro de fecha, hora y duración de la sesión con fines de trazabilidad clínica (Ley N.º 30421); la videollamada en sí no se graba salvo indicación expresa y separada al Usuario.</li>
          <li><strong>Datos de pago:</strong> el monto y estado de la transacción; los datos de la tarjeta de pago son procesados directamente por nuestra pasarela de pagos (Culqi) y no son almacenados por VIDASALUD.</li>
          <li><strong>Datos técnicos:</strong> dirección IP, tipo de dispositivo y navegador, con fines de seguridad y soporte técnico.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalidad del tratamiento">
        <ul>
          <li>Gestionar el registro, autenticación y administración de la cuenta del Usuario.</li>
          <li>Coordinar y prestar el servicio de telemedicina, incluyendo la asignación de médicos, la videoconsulta y la emisión de recetas electrónicas.</li>
          <li>Procesar los pagos de las consultas a través de la pasarela de pagos autorizada.</li>
          <li>Enviar notificaciones operativas sobre citas, recordatorios y confirmaciones (correo electrónico, WhatsApp y notificaciones push).</li>
          <li>Cumplir con obligaciones legales y regulatorias en materia de salud (RENIPRESS, Ley N.º 30421) y de protección al consumidor.</li>
          <li>Mejorar la calidad del servicio mediante estadísticas internas, siempre de forma agregada o anonimizada cuando sea posible.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Base legal y consentimiento">
        <p>
          El tratamiento de sus datos personales se basa en su consentimiento libre, previo, expreso
          e informado, otorgado al crear su cuenta y aceptar esta Política de Privacidad. Para los
          datos sensibles de salud, se solicita un consentimiento específico adicional antes de cada
          consulta, conforme al artículo 14 de la Ley N.º 29733, que exige consentimiento expreso y
          por escrito para el tratamiento de datos sensibles.
        </p>
      </LegalSection>

      <LegalSection title="5. Conservación de los datos">
        <p>
          Sus datos personales se conservarán mientras mantenga una cuenta activa en la Plataforma y,
          respecto de la historia clínica electrónica y registros de atención, por el plazo mínimo
          exigido por la normativa de salud vigente en el Perú, incluso después de que el Usuario
          solicite la baja de su cuenta, en cumplimiento de obligaciones legales de conservación de
          registros médicos.
        </p>
      </LegalSection>

      <LegalSection title="6. Encargados de tratamiento y terceros">
        <p>
          Para operar la Plataforma, VIDASALUD utiliza proveedores de servicios tecnológicos que
          actúan como encargados de tratamiento, bajo obligaciones contractuales de confidencialidad
          y seguridad:
        </p>
        <ul>
          <li><strong>Supabase</strong> — alojamiento de base de datos y autenticación.</li>
          <li><strong>Culqi</strong> — procesamiento de pagos con tarjeta, Yape y Plin.</li>
          <li><strong>Daily.co</strong> — infraestructura de videollamada para las consultas.</li>
          <li><strong>Meta (WhatsApp Business Platform)</strong> — envío de notificaciones y recordatorios por WhatsApp, cuando el Usuario registra su número telefónico.</li>
        </ul>
        <p>
          VIDASALUD no vende ni cede sus datos personales a terceros con fines comerciales o
          publicitarios.
        </p>
      </LegalSection>

      <LegalSection title="7. Transferencia internacional de datos">
        <p>
          Algunos de nuestros proveedores tecnológicos (mencionados en la sección 6) pueden almacenar
          o procesar datos en servidores ubicados fuera del Perú. En dichos casos, VIDASALUD adopta
          las medidas contractuales y técnicas necesarias para garantizar un nivel de protección
          adecuado a sus datos personales, conforme a los artículos 15 y 16 de la Ley N.º 29733.
        </p>
      </LegalSection>

      <LegalSection title="8. Medidas de seguridad">
        <p>
          Implementamos medidas técnicas y organizativas razonables para proteger sus datos
          personales frente a accesos no autorizados, pérdida o alteración, incluyendo cifrado en
          tránsito (HTTPS/TLS), control de acceso basado en roles y políticas de seguridad a nivel de
          base de datos (Row Level Security) que restringen el acceso a la información de salud
          únicamente al paciente, su médico tratante y, cuando corresponda, al personal
          administrativo autorizado.
        </p>
      </LegalSection>

      <LegalSection title="9. Derechos del titular de los datos (Derechos ARCO)">
        <p>
          Como titular de sus datos personales, usted tiene derecho a:
        </p>
        <ul>
          <li><strong>Acceso:</strong> conocer qué datos personales suyos tratamos.</li>
          <li><strong>Rectificación:</strong> corregir datos inexactos o desactualizados.</li>
          <li><strong>Cancelación (supresión):</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios, sujeto a las obligaciones legales de conservación de historia clínica.</li>
          <li><strong>Oposición:</strong> oponerse al tratamiento de sus datos para fines específicos, como el envío de comunicaciones.</li>
          <li><strong>Portabilidad:</strong> solicitar una copia de sus datos en un formato estructurado.</li>
        </ul>
        <p>
          Para ejercer estos derechos, puede escribir a{' '}
          <a href="mailto:clinicavidasaludintegral@gmail.com" style={{ color: '#047857', fontWeight: 700 }}>
            clinicavidasaludintegral@gmail.com
          </a>{' '}
          indicando su nombre completo, DNI y el derecho que desea ejercer. Responderemos dentro del
          plazo establecido por la normativa vigente.
        </p>
      </LegalSection>

      <LegalSection title="10. Uso de cookies y tecnologías similares">
        <p>
          La Plataforma utiliza cookies y almacenamiento local del navegador con fines funcionales
          (mantener su sesión iniciada) y de seguridad. No utilizamos cookies de terceros con fines
          publicitarios.
        </p>
      </LegalSection>

      <LegalSection title="11. Menores de edad">
        <p>
          Los servicios de VIDASALUD para menores de edad deben ser gestionados por su padre, madre o
          tutor legal, quien registra y autoriza la consulta en representación del menor y es
          responsable de la veracidad de los datos proporcionados.
        </p>
      </LegalSection>

      <LegalSection title="12. Cambios a esta política">
        <p>
          Esta Política de Privacidad puede actualizarse periódicamente para reflejar cambios legales
          u operativos. La fecha de la última actualización se indica al inicio de este documento.
          Le recomendamos revisarla periódicamente.
        </p>
      </LegalSection>

      <LegalSection title="13. Autoridad de control">
        <p>
          Si considera que sus derechos de protección de datos personales no han sido atendidos
          adecuadamente, puede presentar una reclamación ante la Autoridad Nacional de Protección de
          Datos Personales del Ministerio de Justicia y Derechos Humanos del Perú.
        </p>
      </LegalSection>

      <LegalSection title="14. Contacto">
        <p>
          Responsable de datos personales — VIDASALUD (RUC 20616174984)<br />
          Dirección: Carhuaz, Ancash, Perú<br />
          Correo: <a href="mailto:clinicavidasaludintegral@gmail.com" style={{ color: '#047857', fontWeight: 700 }}>clinicavidasaludintegral@gmail.com</a><br />
          Teléfono: +51 991 297 354
        </p>
      </LegalSection>

    </LegalPage>
  )
}
