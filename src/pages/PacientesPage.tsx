import { PatientDirectoryRow } from '../components/PatientDirectoryRow'
import { PATIENTS } from '../data/patients'
import { ORG } from '../data/org'

/**
 * Pacientes — directorio longitudinal. Responde "¿quién es este paciente y
 * cuál es su situación actual?". Compacto y escaneable; sin timeline de journey.
 * Orden alfabético (directorio), distinto de la cola priorizada de Journeys.
 */
export function PacientesPage() {
  const patients = [...PATIENTS].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pacientes</h1>
          <div className="page-sub">Directorio de pacientes oncológicos. Abre un paciente para ver su contexto completo.</div>
        </div>
        <div className="page-meta">
          <strong>{PATIENTS.length} pacientes</strong>
          {ORG.name} · {ORG.facilityContext}
        </div>
      </div>
      <div className="card">
        <div className="dir-head">
          <span>Paciente</span>
          <span>Contexto del episodio</span>
          <span style={{ textAlign: 'right', paddingRight: 16 }}>Próxima acción</span>
        </div>
        <div className="directory">
          {patients.map((p) => (
            <PatientDirectoryRow key={p.id} patient={p} />
          ))}
        </div>
      </div>
    </>
  )
}
