// Shown instead of the dashboard while John checks a new academy (src/lib/academy-approval.ts).
export default function AcademyApprovalLock({ orgName, declined }: { orgName: string; declined: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e18] px-4 text-white" data-testid="academy-approval-lock">
      <div className="w-full max-w-md rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-8 text-center">
        {declined ? (
          <>
            <h1 className="text-xl font-bold">We couldn&apos;t open {orgName}</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#93a2ba]">
              This account wasn&apos;t approved. If you run a real academy, email support@theplayerportal.net and we&apos;ll sort it.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Thanks, your email is confirmed</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#93a2ba]">
              We check every new academy before it opens, to keep families safe. We&apos;ll email you as soon as {orgName} is
              ready, usually the same day.
            </p>
            <p className="mt-6 text-xs text-[#93a2ba]">Questions? support@theplayerportal.net</p>
          </>
        )}
      </div>
    </main>
  )
}
