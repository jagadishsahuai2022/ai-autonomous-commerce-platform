import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper override handling
 * Combines clsx for conditional classes with twMerge for Tailwind conflicts
 *
 * @example
 * cn('px-2 py-1', condition && 'rounded-md', 'px-4')
 * // Result: 'py-1 rounded-md px-4' (px-4 overrides px-2)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Create a responsive class builder
 *
 * @example
 * responsive({ base: 'px-4', md: 'px-8', lg: 'px-12' })
 * // Result: 'px-4 md:px-8 lg:px-12'
 */
export function responsive(breakpoints: Record<string, string>): string {
  const { base, sm, md, lg, xl, '2xl': xl2 } = breakpoints;

  return cn(
    base,
    sm && `sm:${sm}`,
    md && `md:${md}`,
    lg && `lg:${lg}`,
    xl && `xl:${xl}`,
    xl2 && `2xl:${xl2}`
  );
}

/**
 * Create a state-based class builder (hover, focus, active, disabled)
 *
 * @example
 * states({
 *   base: 'btn',
 *   hover: 'hover:bg-blue-600',
 *   active: 'active:scale-95',
 *   disabled: 'disabled:opacity-50'
 * })
 */
export function states(
  stateClasses: Record<'base' | 'hover' | 'focus' | 'active' | 'disabled', string>
): string {
  const { base, hover, focus, active, disabled } = stateClasses;

  return cn(base, hover, focus, active, disabled);
}

/**
 * Create a variant builder (useful for component variants)
 *
 * @example
 * variants('primary', {
 *   primary: 'bg-blue-600 text-white',
 *   secondary: 'bg-gray-200 text-gray-900',
 *   ghost: 'text-blue-600 hover:bg-blue-50'
 * })
 * // Result: 'bg-blue-600 text-white'
 */
export function variants<T extends Record<string, string>>(
  variant: keyof T | undefined,
  variantMap: T
): string {
  return variant && variant in variantMap ? variantMap[variant] : variantMap.primary || '';
}

/**
 * Create a size builder
 *
 * @example
 * sizes('md', {
 *   sm: 'px-2 py-1 text-sm',
 *   md: 'px-4 py-2 text-base',
 *   lg: 'px-6 py-3 text-lg'
 * })
 */
export function sizes<T extends Record<string, string>>(
  size: keyof T | undefined,
  sizeMap: T
): string {
  return size && size in sizeMap ? sizeMap[size] : sizeMap.md || '';
}

/**
 * Combine multiple utility builders
 *
 * @example
 * compose(
 *   'btn',
 *   responsive({ md: 'px-8' }),
 *   variants('primary', { primary: 'bg-blue-600' }),
 *   sizes('lg', { lg: 'px-6' })
 * )
 */
export function compose(...classes: string[]): string {
  return cn(...classes);
}

/**
 * Conditional class builder - only add class if condition is true
 *
 * @example
 * conditional(isActive, 'bg-blue-600', 'bg-gray-200')
 * // Result: 'bg-blue-600' or 'bg-gray-200'
 */
export function conditional(condition: boolean, trueClass: string, falseClass?: string): string {
  return condition ? trueClass : falseClass || '';
}

/**
 * Guard class builder - add class only if value exists
 *
 * @example
 * guard(customClass && 'px-4')
 * // Result: 'px-4' if customClass exists, else ''
 */
export function guard(className: string | false | undefined | null): string {
  return className || '';
}

/**
 * Data attribute based styling helper
 *
 * @example
 * dataAttr('role', 'customer', {
 *   customer: 'text-blue-600',
 *   seller: 'text-purple-600',
 *   admin: 'text-red-600'
 * })
 */
export function dataAttr(
  attr: string,
  value: string | undefined,
  attributeMap: Record<string, string>
): string {
  return value && value in attributeMap ? attributeMap[value] : '';
}

export default cn;
