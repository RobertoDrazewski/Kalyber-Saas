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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('telemetria');

  const renderContent = () => {
    switch (activeTab) {
      case 'telemetria': return <TabTelemetria />;
      case 'mantenimiento': return <TabMantenimiento />;
      case 'conductores': return <TabConductores />;
      case 'posicion': return <TabPosicion />;
      case 'calendario': return <TabCalendario />;
      case 'viajes': return <TabViajes />;
      case 'historico': return <TabHistorico />;
      case 'flota': return <TabFlota />;
      default: return <TabTelemetria />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}
