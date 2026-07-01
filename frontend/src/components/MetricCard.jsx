export default function MetricCard({ title, value, icon: Icon, trend }) {
  return (
    <div className="bg-[#1E293B]/70 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white">{value}</h3>
        {trend && <p className="text-xs text-[#10B981] mt-2">{trend}</p>}
      </div>
      <div className="w-12 h-12 rounded-full bg-[#6366F1]/20 flex items-center justify-center text-[#6366F1]">
        <Icon size={24} />
      </div>
    </div>
  );
}