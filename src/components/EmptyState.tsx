export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-white/40">
      <p className="text-sm">{message}</p>
    </div>
  )
}
