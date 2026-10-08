import type { ReactNode } from 'react';

type BadgeVariant = 'emerald' | 'blue' | 'amber' | 'slate' | 'red';

const variants: Record<BadgeVariant, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  red: 'bg-red-50 text-red-700 border-red-200',
};

export function Badge({ variant = 'slate', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${variants[variant]}`}>
      {children}
    </span>
  );
}
