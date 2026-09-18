import { NursingPlanningBoard } from '../components/NursingPlanningBoard'
import { PageHeader } from '../components/PageHeader'

/**
 * Página de PLANEACIÓN DE ENFERMERÍA — centro operativo de Enfermería: la agenda
 * oncológica del día por hora, con estado, bloqueos y próxima acción. Respeta el
 * alcance (sede/programa) del usuario.
 */
export function NursingPlanningPage() {
  return (
    <>
      <PageHeader title="Enfermería · Operaciones"
        sub="Tu día oncológico por hora: quién viene, si el tratamiento está listo, qué lo bloquea y qué sigue." />
      <NursingPlanningBoard />
    </>
  )
}
