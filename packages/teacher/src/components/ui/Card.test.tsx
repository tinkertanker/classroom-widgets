import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import Card from './Card';

describe('Card', () => {
  test('renders children as a column layout', () => {
    render(<Card data-testid="card">Content text</Card>);

    expect(screen.getByText('Content text')).toBeInTheDocument();
    expect(screen.getByTestId('card')).toHaveClass('flex', 'flex-col', 'h-full');
  });

  test('merges custom className with base classes instead of replacing them', () => {
    render(<Card data-testid="card" className="custom-card">x</Card>);

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('custom-card');
    expect(card).toHaveClass('flex');
  });

  test('honours variant, padding, and fullHeight props', () => {
    const { rerender } = render(
      <Card data-testid="card" variant="bordered" padding="none" fullHeight={false}>x</Card>
    );

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('border');
    expect(card).not.toHaveClass('h-full');
    expect(card).not.toHaveClass('p-4');

    rerender(<Card data-testid="card" variant="elevated" padding="large">x</Card>);
    expect(card).toHaveClass('shadow-lg', 'p-6', 'h-full');
  });

  test('forwards arbitrary DOM props', () => {
    render(<Card data-testid="card" role="region" aria-label="My widget">x</Card>);

    const card = screen.getByRole('region', { name: 'My widget' });
    expect(card).toBe(screen.getByTestId('card'));
  });
});
