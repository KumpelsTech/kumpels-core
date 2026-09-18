import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { HoyPage } from './pages/HoyPage'
import { JourneysPage } from './pages/JourneysPage'
import { JourneyDetailPage } from './pages/JourneyDetailPage'
import { NursingPlanningPage } from './pages/NursingPlanningPage'
import { ComunicacionesPage } from './pages/ComunicacionesPage'
import { OperacionesMedicacionPage } from './pages/OperacionesMedicacionPage'
import { PacientesPage } from './pages/PacientesPage'
import { Patient360Page } from './pages/Patient360Page'
import { RevisionClinicaPage } from './pages/RevisionClinicaPage'
import { ConfiguracionPage } from './pages/ConfiguracionPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <HoyPage /> },
      { path: 'patients', element: <PacientesPage /> },
      { path: 'patients/:patientId', element: <Patient360Page /> },
      { path: 'journeys', element: <JourneysPage /> },
      { path: 'journeys/:patientId', element: <JourneyDetailPage /> },
      { path: 'nursing-planning', element: <NursingPlanningPage /> },
      { path: 'communications', element: <ComunicacionesPage /> },
      { path: 'clinical-review', element: <RevisionClinicaPage /> },
      { path: 'medication-operations', element: <OperacionesMedicacionPage /> },
      { path: 'config', element: <ConfiguracionPage /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
])
