import beeldmerk from '@/assets/brand/light-logo-beeldmerk.png';
import white from '@/assets/brand/light-logo-white.png';
import ink from '@/assets/brand/light-logo-ink.png';
import red from '@/assets/brand/light-logo-red.png';
import mark from '@/assets/brand/light-mark.png';
import wordmark from '@/assets/brand/light-wordmark.png';

import { cn } from '@/lib/utils';

const sources = {
  default: beeldmerk,
  white,
  ink,
  red,
  mark,
  wordmark,
};

/**
 * Light Personeelsdiensten logo.
 * variant: default | white | ink | red | mark | wordmark
 * Use `white` on dark surfaces (sidebar), `mark` for compact/avatar spots.
 */
export default function Logo({ variant = 'default', className, alt = 'Light Personeelsdiensten' }) {
  return (
    <img
      src={sources[variant] || sources.default}
      alt={alt}
      className={cn('block h-auto w-auto select-none', className)}
      draggable={false}
    />
  );
}
