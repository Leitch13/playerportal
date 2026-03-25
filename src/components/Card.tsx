export default function Card({
  title,
  children,
  action,
  className = '',
}: {
  title?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-border p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-semibold text-text">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
