import type { ComponentType } from 'react';
import type { FieldType } from '@/lib/types';
import {
  BooleanInput,
  DateInput,
  MultiSelectInput,
  NumberInput,
  RadioInput,
  SelectInput,
  TextInput,
  TextareaInput,
} from './inputs';
import type { FieldInputProps } from './types';

/**
 * Frontend counterpart of the backend's field-type strategy registry.
 *
 * `satisfies Record<FieldType, ...>` makes the exhaustiveness a COMPILE ERROR:
 * add a type to the union without a component here and the build fails. That is
 * the whole extensibility guarantee — supporting a new input type is one
 * component plus one line, and no existing form code is touched.
 */
const FIELD_COMPONENTS = {
  TEXT: TextInput,
  TEXTAREA: TextareaInput,
  NUMBER: NumberInput,
  SELECT: SelectInput,
  MULTISELECT: MultiSelectInput,
  RADIO: RadioInput,
  BOOLEAN: BooleanInput,
  DATE: DateInput,
} satisfies Record<FieldType, ComponentType<FieldInputProps>>;

export function getFieldComponent(type: FieldType): ComponentType<FieldInputProps> {
  // Falls back to a text input so an unrecognised type from a newer backend
  // degrades to something usable instead of crashing the page.
  return FIELD_COMPONENTS[type] ?? TextInput;
}

/** Empty value appropriate to the type, used when initialising a form. */
export function emptyValueFor(type: FieldType): unknown {
  switch (type) {
    case 'MULTISELECT':
      return [];
    case 'BOOLEAN':
      return false;
    default:
      return '';
  }
}
