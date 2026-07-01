import Sidebar from '../components/Sidebar';

export default function DashboardLayout({ children, activeTab, setActiveTab }) {
  return (
    <div className="min-h-screen bg-[#0B1120] flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}