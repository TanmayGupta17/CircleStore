import Link from 'next/link';
import { Alert } from '@/components/ui';

export const metadata = { title: 'Admin — CircleStore' };

/**
 * Admin shell.
 *
 * NOTE: unauthenticated in this build. It sits under its own layout and its own
 * `/api/admin` route prefix precisely so adding authorisation is a single
 * middleware, not a refactor. See README "Out of scope".
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Marketplace admin</h1>
        <p className="mt-1 text-sm text-muted">
          Define the questions each category asks. Changes take effect on the sell flow immediately —
          no deploy.
        </p>
      </div>

      <nav className="mb-6 flex gap-1 border-b border-line">
        <AdminTab href="/admin/categories">Categories</AdminTab>
        <AdminTab href="/admin/fields">Field library</AdminTab>
      </nav>

      <div className="mb-6">
        <Alert tone="warning">
          This admin area is intentionally unauthenticated for the demo.
        </Alert>
      </div>

      {children}
    </div>
  );
}

function AdminTab({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-line hover:text-foreground"
    >
      {children}
    </Link>
  );
}
