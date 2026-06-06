import * as React from 'react';

interface Option { value: string; label: string; }

/**
 * Native select styled to match Input, with a Lucide chevron.
 */
export interface SelectProps {
  label?: string;
  /** Options as strings or {value,label} objects. */
  options?: (string | Option)[];
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

export function Select(props: SelectProps): JSX.Element;
