import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import Card, { CardContent, CardFooter, CardHeader } from './Card';

describe('Card', () => {
  test('lays out header, scrollable content, and footer as a flex column', () => {
    render(
      <Card data-testid="card">
        <CardHeader>Header</CardHeader>
        <CardContent data-testid="card-content">Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );

    expect(screen.getByTestId('card')).toHaveClass('flex', 'flex-col', 'h-full');
    expect(screen.getByTestId('card-content')).toHaveClass('flex-1', 'overflow-y-auto');
  });
});
