import Link from 'next/link';
import { LinkButton } from '@/components/ui';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white"
            aria-hidden
          >
            C
          </span>
          CircleStore
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/admin/fields"
            className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            Admin
          </Link>
          <LinkButton href="/sell" size="sm">
            Sell an item
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}
