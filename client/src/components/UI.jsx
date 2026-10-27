export function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="page-header flex flex-wrap items-end justify-between gap-5">
    <div className="page-header-copy max-w-2xl">{eyebrow && <p className="page-kicker mb-3">{eyebrow}</p>}<h1 className="page-title">{title}</h1>{description && <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">{description}</p>}</div>
    {actions && <div className="page-header-actions flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
}

const progressSteps = ['Submitted', 'In review', 'Approved', 'Issued']
const progressIndex = { draft: -1, pending: 0, under_review: 1, approved: 2, issuing: 2, issued: 3 }

export function ApplicationProgress({ status, className = '' }) {
  const current = progressIndex[status]
  if (current == null) return null
  return <ol aria-label="Application progress" className={`progress-strip ${className}`}>{progressSteps.map((label, index) => {
    const state = status === 'issued' || index < current ? 'done' : index === current ? 'current' : 'next'
    return <li key={label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}><span>0{index + 1}</span>{label}<span className="sr-only">{state === 'done' ? ' (complete)' : state === 'current' ? ' (current step)' : ''}</span></li>
  })}</ol>
}

export function SectionHeading({ title, aside, id }) {
  return <h2 id={id} className="rule-heading"><span>{title}</span>{aside && <span className="normal-case tracking-normal text-xs font-normal text-ink-faint">{aside}</span>}</h2>
}
