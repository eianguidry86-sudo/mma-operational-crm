import { Plus } from 'lucide-react';

interface StatPair {
  label: string;
  value: string;
  tone?: 'default' | 'crimson' | 'green';
}

interface TitleBandProps {
  breadcrumb: string;
  title: string;
  stats?: StatPair[];
  actionLabel?: string;
  onAction?: () => void;
}

const toneClass: Record<NonNullable<StatPair['tone']>, string> = {
  default: 'text-ledger-navy',
  crimson: 'text-ledger-crimson',
  green: 'text-ledger-green',
};

export default function TitleBand({ breadcrumb, title, stats = [], actionLabel, onAction }: TitleBandProps) {
  return (
    <div className="flex-shrink-0 bg-white border-b border-ledger-navy px-7 pt-4 pb-4 flex items-end justify-between gap-6 flex-wrap">
      <div>
        <div className="font-plexMono text-[9px] uppercase tracking-[0.15em] text-ledger-muted mb-1">
          {breadcrumb}
        </div>
        <h1 className="font-serifLedger text-[34px] leading-none text-ledger-navy">{title}</h1>
      </div>

      <div className="flex items-end gap-6">
        {stats.map(stat => (
          <div key={stat.label} className="text-right">
            <div className="font-plexMono text-[9px] uppercase tracking-[0.12em] text-ledger-muted mb-1">
              {stat.label}
            </div>
            <div className={`font-plexMono text-[16px] font-medium leading-none ${toneClass[stat.tone ?? 'default']}`}>
              {stat.value}
            </div>
          </div>
        ))}

        {actionLabel && (
          <button
            onClick={onAction}
            className="flex items-center gap-1.5 bg-ledger-navy text-white font-plexMono text-[10px] uppercase tracking-[0.1em] px-4 py-2.5 hover:bg-ledger-navyHover transition-colors"
          >
            <Plus size={13} />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
