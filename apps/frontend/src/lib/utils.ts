import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utility type for shadcn-svelte components that accept an optional
 * element ref via `bind:this`, plus `class` and `children` props.
 */
export type WithElementRef<T> = T & {
  ref?: HTMLElement | null;
  class?: string;
  children?: any;
};

export type WithoutChildren<T> = Omit<T, 'children'>;
export type WithoutChild<T> = Omit<T, 'child'>;
export type WithoutChildrenOrChild<T> = Omit<T, 'children' | 'child'>;
