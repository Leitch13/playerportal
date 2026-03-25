export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-text-light">
      <p className="text-sm">{message}</p>
    </div>
  )
}
