/**
 * Vitest + React Testing Library tests for CategorySphereFallback
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategorySphereFallback } from '@/components/sphere/CategorySphereFallback';

const CATEGORIES = [
  { name: 'Electronics', count: 40000 },
  { name: 'Fashion', count: 15000 },
  { name: 'Groceries', count: 15000 },
  { name: 'Home & Kitchen', count: 14000 },
  { name: 'Sports', count: 8000 },
  { name: 'Books', count: 8000 },
];

describe('CategorySphereFallback', () => {
  it('renders with testid sphere-fallback', () => {
    render(
      <CategorySphereFallback
        categories={CATEGORIES}
        selectedCategory={null}
        onCategorySelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sphere-fallback')).toBeInTheDocument();
  });

  it('renders all category chips', () => {
    render(
      <CategorySphereFallback
        categories={CATEGORIES}
        selectedCategory={null}
        onCategorySelect={vi.fn()}
      />,
    );
    for (const cat of CATEGORIES) {
      expect(
        screen.getByTestId(`category-chip-${cat.name.replace(/\s+/g, '-').toLowerCase()}`),
      ).toBeInTheDocument();
    }
  });

  it('calls onCategorySelect with category name on chip click', () => {
    const handler = vi.fn();
    render(
      <CategorySphereFallback
        categories={CATEGORIES}
        selectedCategory={null}
        onCategorySelect={handler}
      />,
    );
    fireEvent.click(screen.getByTestId('category-chip-electronics'));
    expect(handler).toHaveBeenCalledWith('Electronics');
  });

  it('marks selected category chip as aria-pressed=true', () => {
    render(
      <CategorySphereFallback
        categories={CATEGORIES}
        selectedCategory="Fashion"
        onCategorySelect={vi.fn()}
      />,
    );
    const fashionChip = screen.getByTestId('category-chip-fashion');
    expect(fashionChip).toHaveAttribute('aria-pressed', 'true');
    // Other chips should not be pressed
    expect(screen.getByTestId('category-chip-electronics')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows clear button when a category is selected', () => {
    render(
      <CategorySphereFallback
        categories={CATEGORIES}
        selectedCategory="Electronics"
        onCategorySelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/clear/i)).toBeInTheDocument();
  });

  it('does not show clear button when no category selected', () => {
    render(
      <CategorySphereFallback
        categories={CATEGORIES}
        selectedCategory={null}
        onCategorySelect={vi.fn()}
      />,
    );
    expect(screen.queryByText(/clear/i)).not.toBeInTheDocument();
  });

  it('clicking clear triggers onCategorySelect with empty string', () => {
    const handler = vi.fn();
    render(
      <CategorySphereFallback
        categories={CATEGORIES}
        selectedCategory="Electronics"
        onCategorySelect={handler}
      />,
    );
    fireEvent.click(screen.getByText(/clear/i));
    expect(handler).toHaveBeenCalledWith('');
  });

  it('renders count abbreviations (40k, 8k, etc.)', () => {
    render(
      <CategorySphereFallback
        categories={CATEGORIES}
        selectedCategory={null}
        onCategorySelect={vi.fn()}
      />,
    );
    // 40000 → "40k"
    expect(screen.getAllByText('40k').length).toBeGreaterThanOrEqual(1);
    // 8000 → "8k"
    expect(screen.getAllByText('8k').length).toBeGreaterThanOrEqual(1);
  });
});
