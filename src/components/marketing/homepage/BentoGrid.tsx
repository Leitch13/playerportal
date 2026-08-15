import { AttendanceMock, PaymentsMock, MigrationMock, CampsMock, MessagesMock, ReportsMock } from './mocks'

export default function BentoGrid() {
  return (
    <section id="product" className="relative scroll-mt-16">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-3xl mb-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#0a97b6] font-semibold mb-6">
            EVERYTHING YOU NEED
          </p>
          <h2 className="text-4xl sm:text-5xl leading-[1.05] tracking-[-0.02em] font-black text-[#0d1b2b]">
            The whole platform.
            <br />
            <span className="text-[#93a2ad]">In one place.</span>
          </h2>
        </div>

        {/* 6-cell bento */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Attendance — 2 cols */}
          <BentoCell label="Attendance" tagline="Register that takes 30 seconds." className="md:col-span-2">
            <AttendanceMock />
          </BentoCell>

          {/* Payments — 2 cols */}
          <BentoCell label="Payments" tagline="Chase nobody. Everyone pays." className="md:col-span-2">
            <PaymentsMock />
          </BentoCell>

          {/* Camps — 2 cols */}
          <BentoCell label="Camps" tagline="Sell out the summer holidays." className="md:col-span-2">
            <CampsMock />
          </BentoCell>

          {/* Migration — 3 cols */}
          <BentoCell label="Migration" tagline="Bring your existing members over in one afternoon." className="md:col-span-3">
            <MigrationMock />
          </BentoCell>

          {/* Reports — 3 cols */}
          <BentoCell label="Reports" tagline="Numbers your last platform never gave you." className="md:col-span-3">
            <ReportsMock />
          </BentoCell>

          {/* Messages — 6 cols */}
          <BentoCell label="Messaging" tagline="In-app. Not WhatsApp. Not email." className="md:col-span-6">
            <MessagesMock />
          </BentoCell>
        </div>
      </div>
    </section>
  )
}

function BentoCell({ label, tagline, children, className = '' }: {
  label: string
  tagline: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`group relative rounded-3xl border border-[#e3ebf0] bg-white p-6 transition-colors hover:border-[#0a97b6]/40 shadow-[0_1px_3px_rgba(13,40,54,0.05),0_10px_24px_-18px_rgba(13,40,54,0.18)] ${className}`}>
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#0a97b6] font-semibold">{label}</p>
        <p className="text-xl lg:text-2xl font-bold text-[#0d1b2b] mt-2 leading-tight">{tagline}</p>
      </div>
      <div className="opacity-95 group-hover:opacity-100 transition-opacity">
        {children}
      </div>
    </div>
  )
}
