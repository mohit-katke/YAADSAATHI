export default function Logo({ size = 'md' }) {
  const box = size === 'lg' ? 'h-16 w-16' : 'h-12 w-12'
  return (
    <div className={`${box} flex items-center justify-center rounded-2xl bg-green text-paper shadow-sm`} aria-hidden="true">
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none">
        <circle cx="24" cy="18" r="8" fill="#FFFDF9" />
        <path d="M12 36c4-8 8-12 12-12s8 4 12 12" stroke="#FFFDF9" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  )
}
