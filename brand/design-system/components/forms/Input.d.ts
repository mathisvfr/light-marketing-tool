import * as React from 'react';

/**
 * Text input with label, red focus ring, optional leading icon, hint & error.
 *
 * @startingPoint section="Forms" subtitle="Labelled text field with focus ring" viewport="700x150"
 */
export interface InputProps {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Leading Lucide icon name. */
  icon?: string | null;
  hint?: string | null;
  /** Error message — turns the field red. */
  error?: string | null;
  required?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

export function Input(props: InputProps): JSX.Element;
