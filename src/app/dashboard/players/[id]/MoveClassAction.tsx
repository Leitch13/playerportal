'use client'

/**
 * Sprint 8b v1 — Player profile Move Class action.
 *
 * Tiny client wrapper rendered inside the Classes card on the player
 * profile page. Renders a small text button that opens the shared
 * MovePlayerModal anchored to the given enrolment. Component is split
 * out from the page because the page is a server component; this
 * island stays a client component for the modal interaction.
 */

import { useState } from 'react'
import MovePlayerModal from '@/components/MovePlayerModal'

export default function MoveClassAction({
  enrolmentId,
  sourceGroupId,
  sourceGroupName,
  playerId,
  playerFirstName,
  playerLastName,
  organisationId,
}: {
  enrolmentId: string
  sourceGroupId: string
  sourceGroupName: string
  playerId: string
  playerFirstName: string
  playerLastName: string
  organisationId: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="player-class-move-action"
        className="text-[11px] font-semibold text-white/55 hover:text-[#4ecde6] transition-colors inline-flex items-center gap-1"
        aria-label={`Move ${playerFirstName} ${playerLastName} out of ${sourceGroupName}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
        Move class
      </button>
      <MovePlayerModal
        open={open}
        onClose={() => setOpen(false)}
        sourceEnrolmentId={enrolmentId}
        sourceGroupId={sourceGroupId}
        sourceGroupName={sourceGroupName}
        playerId={playerId}
        playerFirstName={playerFirstName}
        playerLastName={playerLastName}
        organisationId={organisationId}
      />
    </>
  )
}
