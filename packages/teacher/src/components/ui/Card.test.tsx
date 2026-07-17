import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import Card, { CardContent, CardFooter, CardHeader } from './Card';

describe('Card', () => {
  test('renders header, content, and footer children', () => {
    render(
      <Card data-testid="card">
        <CardHeader>Header text</CardHeader>
        <CardContent data-testid="card-content">Content text</CardContent>
        <CardFooter>Footer text</CardFooter>
      </Card>
    );

    expect(screen.getByText('Header text')).toBeInTheDocument();
    expect(screen.getByText('Content text')).toBeInTheDocument();
    expect(screen.getByText('Footer text')).toBeInTheDocument();
    // Layout contract: column card with a scrollable content region
    expect(screen.getByTestId('card')).toHaveClass('flex', 'flex-col', 'h-full');
    expect(screen.getByTestId('card-content')).toHaveClass('flex-1', 'overflow-y-auto');
  });

  test('merges custom className with base classes instead of replacing them', () => {
    render(
      <Card data-testid="card" className="custom-card">
        <CardContent data-testid="card-content" className="custom-content">x</CardContent>
      </Card>
    );

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('custom-card');
    expect(card).toHaveClass('flex');

    const content = screen.getByTestId('card-content');
    expect(content).toHaveClass('custom-content');
    expect(content).toHaveClass('overflow-y-auto');
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
