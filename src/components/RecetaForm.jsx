import { useState } from 'react'
import { createPortal } from 'react-dom'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981',
  green200: '#A7F3D0', green100: '#D1FAE5', green50: '#ECFDF5',
  red600: '#DC2626', redBg: '#FEF2F2',
  gray900: '#111827', gray700: '#374151', gray500: '#6B7280',
  gray300: '#D1D5DB', gray200: '#E5E7EB', gray100: '#F3F4F6', gray50: '#F9FAFB',
  white: '#FFFFFF',
}

// ─── Helpers ──────────────────────────────────────────────────

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `VIDA-${seg()}-${seg()}`
}

// RGB tuples for jsPDF
const PDF_C = {
  greenDark:  [6, 95, 70],
  greenMid:   [16, 185, 129],
  greenLight: [209, 250, 229],
  green50:    [236, 253, 245],
  white:      [255, 255, 255],
  dark:       [17, 24, 39],
  gray:       [107, 114, 128],
  grayLight:  [229, 231, 235],
  grayBg:     [249, 250, 251],
}

async function loadImageAsBase64(url) {
  const resp = await fetch(url)
  const blob = await resp.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function buildPDF({ doctorName, specialty, cmp, firmaUrl, patientName, patientDNI, diagnosis, medications, verificationCode, indications }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const W = 210
  const ml = 18, mr = 18
  const cw = W - ml - mr   // 174 mm

  const { greenDark, greenMid, greenLight, green50, white, dark, gray, grayLight, grayBg } = PDF_C

  // ─── HEADER BAND ──────────────────────────────────────────
  doc.setFillColor(...greenDark)
  doc.rect(0, 0, W, 40, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...white)
  doc.text('VIDASALUD', ml, 17)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(209, 250, 229)
  doc.text('Plataforma de Telemedicina - Peru', ml, 25)

  // Date top-right
  const dateStr = new Date().toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric',
  })
  doc.setFontSize(9)
  doc.text(dateStr, W - mr, 17, { align: 'right' })

  // Badge
  doc.setFillColor(...greenMid)
  doc.roundedRect(W - mr - 46, 22, 46, 14, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...white)
  doc.text('RECETA ELECTRONICA', W - mr - 23, 31, { align: 'center' })

  // Accent line
  doc.setFillColor(...greenMid)
  doc.rect(0, 40, W, 1.5, 'F')

  // ─── DOCTOR / PATIENT COLUMNS ─────────────────────────────
  let y = 45
  const colW = (cw - 6) / 2

  const drTitle = specialty?.toLowerCase().includes('psic') ? 'Psic.' : 'Dr(a).'

  // Doctor box
  doc.setFillColor(...green50)
  doc.setDrawColor(...greenLight)
  doc.setLineWidth(0.4)
  doc.roundedRect(ml, y, colW, 32, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...greenDark)
  doc.text('MEDICO TRATANTE', ml + 4, y + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...dark)
  doc.text(`${drTitle} ${doctorName}`, ml + 4, y + 15, { maxWidth: colW - 8 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...gray)
  if (specialty) doc.text(specialty, ml + 4, y + 22)
  doc.text(`CMP: ${cmp || 'N/A'}`, ml + 4, y + 29)

  // Patient box
  const px = ml + colW + 6
  doc.setFillColor(...green50)
  doc.roundedRect(px, y, colW, 32, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...greenDark)
  doc.text('DATOS DEL PACIENTE', px + 4, y + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...dark)
  doc.text(patientName, px + 4, y + 15, { maxWidth: colW - 8 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...gray)
  if (patientDNI) doc.text(`DNI: ${patientDNI}`, px + 4, y + 22)
  const fullDate = new Date().toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric',
  })
  doc.text(`Fecha: ${fullDate}`, px + 4, y + 29)

  y += 38

  // ─── DIAGNOSIS ────────────────────────────────────────────
  doc.setFillColor(...greenLight)
  doc.rect(ml, y, cw, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...greenDark)
  doc.text('DIAGNOSTICO (CIE-10)', ml + 4, y + 5.5)

  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...dark)
  const diagLines = doc.splitTextToSize(diagnosis || 'No especificado', cw - 8)
  doc.text(diagLines, ml + 4, y)
  y += diagLines.length * 5.5 + 8

  // ─── Rx TITLE ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bolditalic')
  doc.setFontSize(24)
  doc.setTextColor(...greenDark)
  doc.text('Rx', ml, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...dark)
  doc.text('PRESCRIPCION MEDICA', ml + 14, y + 6)
  y += 12

  // ─── MEDICATIONS TABLE ────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [['N', 'Medicamento', 'Dosis', 'Frecuencia', 'Duracion']],
    body: medications.map((m, i) => [
      String(i + 1),
      m.nombre  || '-',
      m.dosis   || '-',
      m.frecuencia || '-',
      m.duracion   || '-',
    ]),
    margin: { left: ml, right: mr },
    headStyles: {
      fillColor: greenDark, textColor: white,
      fontStyle: 'bold', fontSize: 9, cellPadding: 4,
    },
    bodyStyles: { fontSize: 9, textColor: dark, cellPadding: 4 },
    alternateRowStyles: { fillColor: grayBg },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 62 },
      2: { cellWidth: 24 },
      3: { cellWidth: 45 },
      4: { cellWidth: 33 },
    },
    styles: { lineColor: grayLight, lineWidth: 0.3 },
  })

  y = doc.lastAutoTable.finalY + 10

  // ─── INDICATIONS (optional) ────────────────────────────────
  if (indications?.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...greenDark)
    doc.text('INDICACIONES ADICIONALES:', ml, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...dark)
    const indLines = doc.splitTextToSize(indications, cw - 4)
    doc.text(indLines, ml, y)
    y += indLines.length * 5 + 8
  }

  // ─── SIGNATURE + VERIFICATION CODE ───────────────────────
  if (y > 230) { doc.addPage(); y = 20 }

  // Left column: signature block
  const sigW = 95

  if (firmaUrl) {
    try {
      const imgData = await loadImageAsBase64(firmaUrl)
      doc.addImage(imgData, ml, y, 60, 20)
    } catch {
      doc.setDrawColor(...grayLight)
      doc.setLineWidth(0.4)
      doc.line(ml, y + 18, ml + sigW, y + 18)
    }
  } else {
    doc.setDrawColor(...grayLight)
    doc.setLineWidth(0.4)
    doc.line(ml, y + 18, ml + sigW, y + 18)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...dark)
  doc.text(doctorName, ml, y + 24)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...gray)
  doc.text(specialty, ml, y + 30)
  doc.text(`${cmp.startsWith('CPsP') ? cmp : 'CMP ' + cmp}`, ml, y + 36)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...greenDark)
  doc.text('Firma digital verificada - VIDASALUD', ml, y + 43)

  // Right column: verification box
  const vx = W - mr - 68
  doc.setFillColor(...green50)
  doc.setDrawColor(...greenLight)
  doc.roundedRect(vx, y, 68, 46, 3, 3, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...greenDark)
  doc.text('CODIGO DE VERIFICACION', vx + 34, y + 8, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...greenDark)
  doc.text(verificationCode, vx + 34, y + 20, { align: 'center' })

  doc.setDrawColor(...greenLight)
  doc.setLineWidth(0.3)
  doc.line(vx + 8, y + 25, vx + 60, y + 25)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...gray)
  doc.text('vidasalud.pe/verificar', vx + 34, y + 32, { align: 'center' })
  doc.text('Valida bajo Ley 30421', vx + 34, y + 39, { align: 'center' })

  // ─── FOOTER ───────────────────────────────────────────────
  const fy = 277
  doc.setFillColor(...greenDark)
  doc.rect(0, fy, W, 0.6, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...gray)
  doc.text(
    'Receta emitida electronicamente mediante VIDASALUD · Valida segun Ley 30421 - Ley de Receta Medica Electronica · RENIPRESS registrado · Colegio Medico del Peru',
    W / 2, fy + 6, { align: 'center', maxWidth: cw },
  )
  doc.text(
    'Esta receta es valida por 30 dias desde su emision · Para verificar autenticidad visite vidasalud.pe/verificar',
    W / 2, fy + 12, { align: 'center', maxWidth: cw },
  )

  return doc
}

// ─── Medication row ───────────────────────────────────────────

function MedRow({ med, idx, onChange, onRemove, canRemove }) {
  const fieldStyle = (focused) => ({
    width: '100%', padding: '8px 10px',
    border: `1.5px solid ${focused ? C.green500 : C.gray300}`,
    borderRadius: 8, fontSize: 13, color: C.gray900,
    background: C.white, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  })

  const [focusedField, setFocused] = useState(null)
  const fProps = (field) => ({
    onFocus: () => setFocused(field),
    onBlur:  () => setFocused(null),
    style: fieldStyle(focusedField === field),
  })

  return (
    <div style={{
      background: C.white, border: `1.5px solid ${C.gray200}`,
      borderRadius: 12, padding: '14px 14px 10px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: C.green700, color: C.white,
          fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {idx + 1}
        </span>
        <input
          type="text"
          placeholder="Nombre del medicamento"
          value={med.nombre}
          onChange={e => onChange(idx, 'nombre', e.target.value)}
          {...fProps('nombre')}
          style={{ ...fieldStyle(focusedField === 'nombre'), flex: 1 }}
        />
        {canRemove && (
          <button
            onClick={() => onRemove(idx)}
            title="Eliminar"
            style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: 8,
              border: `1px solid ${C.gray200}`, background: C.white,
              color: C.red600, fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.gray500, display: 'block', marginBottom: 3 }}>Dosis</label>
          <input
            type="text"
            placeholder="ej: 500mg"
            value={med.dosis}
            onChange={e => onChange(idx, 'dosis', e.target.value)}
            {...fProps('dosis' + idx)}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.gray500, display: 'block', marginBottom: 3 }}>Frecuencia</label>
          <input
            type="text"
            placeholder="ej: cada 8h"
            value={med.frecuencia}
            onChange={e => onChange(idx, 'frecuencia', e.target.value)}
            {...fProps('frec' + idx)}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.gray500, display: 'block', marginBottom: 3 }}>Duración</label>
          <input
            type="text"
            placeholder="ej: 7 días"
            value={med.duracion}
            onChange={e => onChange(idx, 'duracion', e.target.value)}
            {...fProps('dur' + idx)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────

export default function RecetaForm({ appointment, doctorInfo, doctorName, soap, onClose, onSuccess }) {
  const [diagnosis,    setDiagnosis]    = useState(soap?.a?.trim() || '')
  const [medications,  setMedications]  = useState([{ nombre: '', dosis: '', frecuencia: '', duracion: '' }])
  const [indications,  setIndications]  = useState('')
  const [generating,   setGenerating]   = useState(false)
  const [indicFocused, setIndicFocused] = useState(false)
  const [diagFocused,  setDiagFocused]  = useState(false)

  const patient    = appointment?.patient ?? {}
  const patientName = patient.full_name ?? 'Paciente'
  const patientDNI  = patient.dni ?? ''

  function addMed() {
    setMedications(prev => [...prev, { nombre: '', dosis: '', frecuencia: '', duracion: '' }])
  }

  function removeMed(idx) {
    setMedications(prev => prev.filter((_, i) => i !== idx))
  }

  function updateMed(idx, field, value) {
    setMedications(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }

  async function handleGenerate() {
    console.log('[RecetaForm] iniciando generacion')
    const filled = medications.filter(m => m.nombre.trim())
    if (!filled.length) {
      toast.error('Agrega al menos un medicamento')
      return
    }

    setGenerating(true)
    const verificationCode = genCode()

    try {
      // Build PDF
      const doc = await buildPDF({
        doctorName:   doctorName ?? 'Médico',
        specialty:    doctorInfo?.especialidad ?? '',
        cmp:          doctorInfo?.cmp ?? '',
        firmaUrl:     doctorInfo?.firma_url ?? null,
        patientName,
        patientDNI,
        diagnosis:    diagnosis || 'No especificado',
        medications:  filled,
        indications,
        verificationCode,
      })

      const fileName = `receta-${appointment?.id ?? 'local'}-${Date.now()}.pdf`

      // Upload to Supabase Storage
      let pdfUrl = null
      try {
        const blob = doc.output('blob')
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('recetas')
          .upload(fileName, blob, { contentType: 'application/pdf', upsert: false })

        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from('recetas').getPublicUrl(uploadData.path)
          pdfUrl = urlData?.publicUrl ?? null
        } else {
          console.warn('[RecetaForm] Storage upload failed:', uploadErr?.message)
        }
      } catch (storageEx) {
        console.warn('[RecetaForm] Storage exception:', storageEx)
      }

      // Save record in prescriptions table
      if (pdfUrl && appointment?.id) {
        const appointment_id = appointment.id
        const doctor_id      = doctorInfo?.id
        const patient_id     = appointment.patient_id
        console.log('[RecetaForm] insert payload:', { appointment_id, doctor_id, patient_id })
        const { data, error } = await supabase
          .from('prescriptions')
          .insert({
            appointment_id,
            doctor_id,
            patient_id,
            verification_code: verificationCode,
            diagnosis,
            medicines:         filled,
            pdf_url:           pdfUrl,
          })
          .select()
        console.log('[RecetaForm] insert result:', { data, error })
      } else {
        console.warn('[RecetaForm] insert skipped — pdfUrl:', pdfUrl, '| appointment?.id:', appointment?.id)
      }

      // Download locally
      doc.save(fileName)

      toast.success('Receta generada y descargada correctamente', { duration: 4000 })
      onSuccess?.()
    } catch (err) {
      console.error('[RecetaForm] Error generating PDF:', err)
      toast.error('Error al generar la receta. Intenta de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  const inputBase = (focused) => ({
    width: '100%', padding: '10px 12px',
    border: `1.5px solid ${focused ? C.green500 : C.gray300}`,
    borderRadius: 10, fontSize: 13, color: C.gray900,
    background: C.white, outline: 'none', resize: 'vertical',
    fontFamily: 'inherit', lineHeight: 1.5,
    boxShadow: focused ? '0 0 0 3px rgba(16,185,129,0.1)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  })

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9997,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes rf-up { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.gray300}; border-radius: 4px; }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 520,
        maxHeight: '94vh',
        background: C.gray50,
        borderRadius: '24px 24px 0 0',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'rf-up 0.28s ease',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
          padding: '18px 20px', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>💊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Receta Electrónica</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>
              {patientName} · Ley 30421
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: C.white, fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}>×</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 4px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Diagnóstico */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: C.green800, display: 'block', marginBottom: 6 }}>
              Diagnóstico <span style={{ color: C.gray500, fontWeight: 400 }}>· Incluye código CIE-10 si aplica</span>
            </label>
            <textarea
              rows={2}
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
              onFocus={() => setDiagFocused(true)}
              onBlur={() => setDiagFocused(false)}
              placeholder="ej: (J00) Rinofaringitis aguda · Cefalea tensional"
              style={inputBase(diagFocused)}
            />
          </div>

          {/* Medicamentos */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.green800, marginBottom: 10 }}>
              Medicamentos <span style={{ color: C.red600 }}>*</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {medications.map((med, idx) => (
                <MedRow
                  key={idx}
                  med={med}
                  idx={idx}
                  onChange={updateMed}
                  onRemove={removeMed}
                  canRemove={medications.length > 1}
                />
              ))}
            </div>
            <button
              onClick={addMed}
              style={{
                marginTop: 10, width: '100%', padding: '10px 0',
                background: C.white, border: `1.5px dashed ${C.green500}`,
                borderRadius: 10, color: C.green700, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + Agregar medicamento
            </button>
          </div>

          {/* Indicaciones adicionales */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: C.green800, display: 'block', marginBottom: 6 }}>
              Indicaciones adicionales <span style={{ color: C.gray500, fontWeight: 400 }}>· Opcional</span>
            </label>
            <textarea
              rows={2}
              value={indications}
              onChange={e => setIndications(e.target.value)}
              onFocus={() => setIndicFocused(true)}
              onBlur={() => setIndicFocused(false)}
              placeholder="ej: Tomar con alimentos. Reposo relativo. Control en 7 días si no mejora."
              style={inputBase(indicFocused)}
            />
          </div>

          {/* Info paciente */}
          <div style={{
            background: C.white, border: `1.5px solid ${C.gray200}`,
            borderRadius: 12, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green800, marginBottom: 2 }}>
              Vista previa del membrete
            </div>
            <div style={{ fontSize: 12, color: C.gray700 }}>
              <strong>Médico:</strong> {doctorName}{doctorInfo?.especialidad ? ` · ${doctorInfo.especialidad}` : ''}{doctorInfo?.cmp ? ` · CMP ${doctorInfo.cmp}` : ''}
            </div>
            <div style={{ fontSize: 12, color: C.gray700 }}>
              <strong>Paciente:</strong> {patientName}{patientDNI ? ` · DNI ${patientDNI}` : ''}
            </div>
          </div>

        </div>

        {/* ── Footer actions ── */}
        <div style={{ padding: '16px 20px 20px', background: C.white, borderTop: `1.5px solid ${C.gray200}`, flexShrink: 0 }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: '100%', padding: '15px 0',
              background: generating
                ? C.green100
                : `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
              color: generating ? C.green700 : C.white,
              border: 'none', borderRadius: 14,
              fontSize: 14, fontWeight: 800,
              cursor: generating ? 'not-allowed' : 'pointer',
              boxShadow: generating ? 'none' : '0 4px 16px rgba(5,150,105,0.3)',
              transition: 'all 0.15s', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{generating ? '⏳' : '📄'}</span>
            {generating ? 'Generando receta…' : 'Generar Receta PDF'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: C.gray500 }}>
            El PDF se descarga automáticamente · Se guarda en historial del paciente
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}
