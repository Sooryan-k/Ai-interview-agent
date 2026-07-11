import { cn } from "@/lib/utils";

const WIDTHS = {
  narrow: "max-w-2xl", // forms, focused flows
  reading: "max-w-3xl", // default content pages
  wide: "max-w-6xl", // dashboard grids
} as const;

/**
 * Standard page container + header so every page shares the same rhythm:
 * responsive gutters, consistent title/description typography, actions slot.
 */
export function PageShell({
  title,
  description,
  actions,
  maxWidth = "reading",
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: keyof typeof WIDTHS;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6 sm:py-10",
        WIDTHS[maxWidth],
        className
      )}
    >
      {(title || actions) && (
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            {title && (
              <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      {children}
    </main>
  );
}
