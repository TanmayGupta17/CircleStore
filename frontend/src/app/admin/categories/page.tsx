import { CategoryList } from '@/components/admin/category-list';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  // Data is fetched inside the try; JSX is constructed outside it, so a render
  // error can never be swallowed by this catch.
  let categories = null;

  try {
    categories = await api.admin.categories.list();
  } catch {
    categories = null;
  }

  if (!categories) {
    return (
      <Alert tone="danger" title="Cannot reach the API">
        Start the backend with <code className="font-mono">npm run dev</code> in{' '}
        <code className="font-mono">backend/</code>, then reload.
      </Alert>
    );
  }

  return <CategoryList initialCategories={categories} />;
}
