import { useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import TabTelemetria from '../components/TabTelemetria';
import TabMantenimiento from '../components/TabMantenimiento';
import TabConductores from '../components/TabConductores';
import TabPosicion from '../components/TabPosicion';
import TabViajes from '../components/TabViajes';
import TabHistorico from '../components/TabHistorico';
import TabFlota from '../components/TabFlota';
import TabCalendario from '../components/TabCalendario';
import TabEquipos from '../components/TabEquipos';
import TabUsuarios from '../components/TabUsuarios';
import TabFacturador from '../components/TabFacturador';
import TabDiagnostico from '../components/TabDiagnostico';
import TabComandos from '../components/TabComandos';
import TabMantenimientoRealizado from '../components/TabMantenimientoRealizado';
import TabApiKeys from '../components/TabApiKeys';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('telemetria');

  const renderContent = () => {
    switch (activeTab) {
      case 'telemetria': return <TabTelemetria />;
      case 'mantenimiento': return <TabMantenimiento />;
      case 'mantenimientoRealizado': return <TabMantenimientoRealizado />;
      case 'conductores': return <TabConductores />;
      case 'posicion': return <TabPosicion />;
      case 'calendario': return <TabCalendario />;
      case 'viajes': return <TabViajes />;
      case 'historico': return <TabHistorico />;
      case 'flota': return <TabFlota />;
      case 'equipos': return <TabEquipos />;
      case 'usuarios': return <TabUsuarios />;
      case 'facturador': return <TabFacturador />;
      case 'diagnostico': return <TabDiagnostico />;
      case 'comandos': return <TabComandos />;
      case 'apikeys': return <TabApiKeys />;
      default: return <TabTelemetria />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}
