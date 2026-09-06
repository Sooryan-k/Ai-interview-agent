/**
 * The dryrun AI bullseye, matching public/icon.svg exactly.
 *
 * Geometry is the logo's own, scaled from its 512 artboard to a 24 viewBox
 * (×24/512): r 176→8.25, 104→4.875, 32→1.5, stroke 40→1.875. Previously the
 * app used lucide's Target here, which is a similar but visibly different
 * shape (r 10/6/2, thicker stroke) — so the in-app mark didn't quite match
 * the installed app icon.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.875"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="4.875" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
