import { SellFlow } from '@/components/sell/sell-flow';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sell an item — CircleStore' };

export default async function SellPage() {
  let categories;

  try {
    categories = await api.categories.list();
  } catch {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="danger" title="Cannot reach the API">
          Start the backend with <code className="font-mono">npm run dev</code> in{' '}
          <code className="font-mono">backend/</code>, then reload this page.
        </Alert>
      </div>
    );
  }

  return <SellFlow categories={categories} />;
}
