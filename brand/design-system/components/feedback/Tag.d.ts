import * as React from 'react';

/**
 * Neutral keyword / filter chip with optional selected and removable states.
 */
export interface TagProps {
  selected?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Tag(props: TagProps): JSX.Element;
