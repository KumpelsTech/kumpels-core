import { PatientRow } from '../components/PatientRow'
import { PATIENTS } from '../data/patients'
import { PRIORITY_ORDER } from '../utils/patient'

/**
 * Revisión Clínica — cola de pacientes priorizados que requieren revisión.
 * En esta iteración solo actúa como punto de entrada a Patient 360
 * ("Abrir paciente"). La lógica de revisión no se construye aquí todavía.
 */
export function RevisionClinicaPage() {
  const queue = PATIENTS.filter((p) => p.requiresReview).sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Revisión Clínica</h1>
          <div className="page-sub">Pacientes priorizados por criterios clínicos, cambios de tratamiento y seguimiento.</div>
        </div>
        <div className="page-meta">
          <strong>{queue.length} en cola</strong>
          Ordenados por prioridad
        </div>
      </div>
      <div className="card">
        <div className="plist">
          {queue.map((p) => (
            <PatientRow key={p.id} patient={p} ctaLabel="Revisar" openOnTab="revision" />
          ))}
        </div>
      </div>
    </>
  )
}
