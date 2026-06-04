/**
 * Sprint 10 — small client wrapper for window.print().
 *
 * Lives next to the print page so the rest of the register can stay as
 * a pure server component.
 */
'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-testid="print-register-button"
    >
      🖨️ Print this register
    </button>
  )
}
