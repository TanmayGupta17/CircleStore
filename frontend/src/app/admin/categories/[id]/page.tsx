import { notFound } from 'next/navigation';
import { CategoryBuilder } from '@/components/admin/category-builder';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface CategoryBuilderPageProps {
  params: Promise<{ id: string }>;
}

export default async function CategoryBuilderPage({ params }: CategoryBuilderPageProps) {
  const { id } = await params;

  let categories;
  let fields;

  try {
    [categories, fields] = await Promise.all([api.admin.categories.list(), api.admin.fields.list()]);
  } catch {
    return (
      <Alert tone="danger" title="Cannot reach the API">
        Start the backend with <code className="font-mono">npm run dev</code> in{' '}
        <code className="font-mono">backend/</code>, then reload.
      </Alert>
    );
  }

  const category = categories.find((item) => item.id === id);
  if (!category) notFound();

  return <CategoryBuilder category={category} allFields={fields} />;
}
