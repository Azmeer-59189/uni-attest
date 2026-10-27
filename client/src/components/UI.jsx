import { Check, FileCheck2 } from 'lucide-react'

export function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="page-header flex flex-wrap items-start justify-between gap-5">
    <div className="page-header-copy max-w-2xl"><p className="page-kicker mb-2.5">{eyebrow}</p><h1 className="page-title">{title}</h1>{description && <p className="mt-3 text-sm leading-relaxed text-slate-500">{description}</p>}</div>
    {actions && <div className="page-header-actions flex flex-wrap items-center gap-2 sm:pt-5">{actions}</div>}
  </header>
}

export function StatCard({ label, value, caption, icon: Icon = FileCheck2, accent = 'text-navy bg-slate-100' }) {
  return <div className="metric-card"><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-slate-500">{label}</span><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-4xl font-semibold tracking-tight text-navy tabular-nums">{value}</p>{caption && <p className="mt-2 text-xs text-slate-500">{caption}</p>}</div>
}

export function ApplicationProgress({ status }) {
  const steps = ['Submitted', 'In review', 'Approved', 'Issued']
  const current = { draft: -1, pending: 0, under_review: 1, approved: 2, issuing: 2, issued: 3 }[status]
  if (current == null) return null
  return <ol aria-label="Application status" className="grid grid-cols-4 gap-1 border-t border-slate-100 pt-5 mt-4">{steps.map((label, index) => <li key={label} className="relative flex flex-col gap-2 items-start text-xs" aria-current={current === index ? 'step' : undefined}>
    <div className={`absolute top-3.5 left-8 right-1 h-px ${index < current ? 'bg-emerald-200' : 'bg-slate-100'} ${index === 3 ? 'hidden' : ''}`} />
    <span className={`progress-node relative ${index < current ? 'bg-emerald-50 text-emerald-700' : index === current ? 'bg-navy text-gold ring-4 ring-slate-50' : 'bg-slate-100 text-slate-500'}`}>{index < current ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
    <span className={index <= current ? 'text-navy font-medium' : 'text-slate-500'}>{label}</span>
  </li>)}</ol>
}

export function SectionHeading({ title, description, aside }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-semibold tracking-tight text-navy">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{aside}</div>
}
