import type { FieldDefinition } from '@/lib/types';

/**
 * The contract every field-type component implements.
 *
 * Uniform props are what let `DynamicForm` render an arbitrary field without
 * knowing its type — it looks the component up in the registry and hands it
 * these props.
 */
export interface FieldInputProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  /** DOM id, wired to the label and to `aria-describedby` for errors. */
  id: string;
  hasError?: boolean;
  describedBy?: string;
  disabled?: boolean;
}
