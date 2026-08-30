export default function Toast({ message, onClose }) {
  if (!message) return null
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="flex max-w-lg items-center gap-3 rounded-2xl border-2 border-green bg-paper px-5 py-4 text-lg font-bold text-ink shadow-lg">
        <span className="flex-1">{message}</span>
        <button type="button" onClick={onClose} className="min-h-12 min-w-12 rounded-xl bg-green px-4 text-white">
          OK
        </button>
      </div>
    </div>
  )
}
