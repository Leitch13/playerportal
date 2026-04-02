'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 bg-[#4ecde6] text-black text-sm font-semibold rounded-xl hover:bg-[#4ecde6]/90 transition-colors"
    >
      Print Register
    </button>
  )
}
