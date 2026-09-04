interface BadgeProps {
  label: string;
  variant?: 'navy' | 'crimson' | 'green' | 'yellow' | 'orange' | 'gray' | 'blue';
  size?: 'sm' | 'xs';
}

const variantClasses: Record<string, string> = {
  navy: 'bg-navy-100 text-navy-700',
  crimson: 'bg-crimson-100 text-crimson-700',
  green: 'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  gray: 'bg-surface-200 text-navy-500',
  blue: 'bg-blue-100 text-blue-700',
};

export default function Badge({ label, variant = 'gray', size = 'sm' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-2 py-0.5 text-2xs'
    } ${variantClasses[variant]}`}>
      {label}
    </span>
  );
}

export function getLeadStageBadge(stage: string): { variant: BadgeProps['variant']; label: string } {
  const map: Record<string, BadgeProps['variant']> = {
    'New Lead': 'blue',
    'Contacted': 'navy',
    'Discovery Scheduled': 'navy',
    'Discovery Complete': 'navy',
    'Proposal Drafting': 'yellow',
    'Proposal Sent': 'yellow',
    'Negotiation': 'orange',
    'Verbal Agreement': 'orange',
    'Agreement Signed': 'green',
    'Invoice Sent': 'green',
    'Client Onboarding': 'green',
    'Project Created': 'green',
    'Proposal Lost': 'crimson',
    'No Response': 'gray',
    'Not a Fit': 'gray',
    'Future Opportunity': 'gray',
  };
  return { variant: map[stage] ?? 'gray', label: stage };
}

export function getProjectStatusBadge(status: string): { variant: BadgeProps['variant']; label: string } {
  const map: Record<string, BadgeProps['variant']> = {
    'Project Acceptance': 'blue',
    'Data Acquisition / Validation': 'yellow',
    'Analysis': 'orange',
    'Analysis QC': 'orange',
    'Report Generation': 'navy',
    'Final Product QC': 'navy',
    'Delivery': 'green',
    'Completed': 'green',
    'On Hold': 'gray',
  };
  return { variant: map[status] ?? 'gray', label: status };
}

export function getInvoiceStatusBadge(status: string): { variant: BadgeProps['variant']; label: string } {
  const map: Record<string, BadgeProps['variant']> = {
    'Draft': 'gray',
    'Sent': 'blue',
    'Paid': 'green',
    'Overdue': 'crimson',
    'Cancelled': 'gray',
  };
  return { variant: map[status] ?? 'gray', label: status };
}

export function getTaskPriorityBadge(priority: string): { variant: BadgeProps['variant']; label: string } {
  const map: Record<string, BadgeProps['variant']> = {
    'Critical': 'crimson',
    'High': 'orange',
    'Medium': 'yellow',
    'Low': 'gray',
  };
  return { variant: map[priority] ?? 'gray', label: priority };
}
