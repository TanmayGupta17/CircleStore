import { FieldLibrary } from '@/components/admin/field-library';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function AdminFieldsPage() {
  // Data is fetched inside the try; JSX is constructed outside it, so a render
  // error can never be swallowed by this catch.
  let data: Awaited<ReturnType<typeof loadData>> | null = null;

  try {
    data = await loadData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <Alert tone="danger" title="Cannot reach the API">
        Start the backend with <code className="font-mono">npm run dev</code> in{' '}
        <code className="font-mono">backend/</code>, then reload.
      </Alert>
    );
  }

  return <FieldLibrary initialFields={data.fields} fieldTypes={data.fieldTypes} />;
}

async function loadData() {
  const [fields, fieldTypes] = await Promise.all([api.admin.fields.list(), api.fieldTypes()]);
  return { fields, fieldTypes };
}
