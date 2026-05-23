import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import Button from './Button';
import HudButton, { HudGroupButton } from './HudButton';
import MenuItem from './MenuItem';

const Icon = ({ className }: { className?: string }) => (
  <svg className={className} aria-hidden="true" />
);

describe('button UI components', () => {
  const cases = [
    {
      name: 'Button',
      render: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <Button {...props}>Cancel</Button>
      )
    },
    {
      name: 'HudButton',
      render: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <HudButton {...props} icon={Icon} aria-label="Cancel" />
      )
    },
    {
      name: 'HudGroupButton',
      render: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <HudGroupButton {...props}>Cancel</HudGroupButton>
      )
    },
    {
      name: 'MenuItem',
      render: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <MenuItem {...props}>Cancel</MenuItem>
      )
    }
  ];

  test.each(cases)('$name does not submit enclosing forms by default', ({ render: renderButton }) => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    render(
      <form onSubmit={onSubmit}>
        {renderButton({})}
      </form>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test.each(cases)('$name allows explicit submit type', ({ render: renderButton }) => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    render(
      <form onSubmit={onSubmit}>
        {renderButton({ type: 'submit' })}
      </form>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
