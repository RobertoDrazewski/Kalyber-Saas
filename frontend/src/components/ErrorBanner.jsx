export default function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-4 text-sm">
      <strong>No se pudieron cargar los datos:</strong> {message}
    </div>
  );
}
