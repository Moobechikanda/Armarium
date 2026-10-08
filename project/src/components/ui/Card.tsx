import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className = '', onClick, hoverable = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${hoverable ? 'transition-all duration-200 hover:shadow-md hover:border-slate-300 cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
