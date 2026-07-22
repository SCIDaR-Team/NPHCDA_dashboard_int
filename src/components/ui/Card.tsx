import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { hover?: boolean }>(
  ({ className, hover, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // min-w-0 is load-bearing: as a grid/flex item a Card defaults to
        // min-width:auto, so a child that momentarily reports a wider intrinsic size
        // (an ECharts canvas still carrying the previous layout's pixel width while
        // the sidebar animates) would refuse to shrink and paint over the next column.
        'min-w-0 rounded-card border border-border bg-bg-elev shadow-card',
        hover && 'transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-card-hover',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-2.5 border-b border-border-soft px-5 py-3.5', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-[14.5px] font-bold text-text', className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

/** Section block with the signature accent bar from the original design. */
export function SectionBlock({
  title,
  tone = 'brand',
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  tone?: 'brand' | 'danger' | 'warning';
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const barColor =
    tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-brand';
  return (
    <Card className={cn('mb-5 overflow-hidden', className)}>
      <CardHeader className="flex-wrap justify-between gap-y-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('h-[18px] w-1 flex-shrink-0 rounded-sm', barColor)} />
          <CardTitle>{title}</CardTitle>
        </div>
        {action}
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
