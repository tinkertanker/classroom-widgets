import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetType } from '@shared/types';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import TextBanner from './textBanner';

const workspaceMock = vi.hoisted(() => ({ layoutFormat: 'canvas' }));

vi.mock('./hooks', () => ({
  useAutoFontSize: () => 48
}));

vi.mock('../../../store/workspaceStore.simple', () => ({
  useWorkspaceStore: (selector: (state: { layoutFormat: string }) => unknown) =>
    selector(workspaceMock)
}));

afterEach(() => {
  vi.clearAllMocks();
  workspaceMock.layoutFormat = 'canvas';
});

describe('TextBanner text editor', () => {
  it('uses an explicit Add text action and keeps the transactional editor inside the widget', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(<TextBanner onStateChange={onStateChange} />);

    expect(screen.queryByText('Double-click to edit')).not.toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: 'Add text' });

    await user.click(addButton);

    const editor = screen.getByRole('region', { name: 'Add banner text' });
    expect(editor.closest('.widget-container-custom-surface')).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(editor).queryByText('Appearance')).not.toBeInTheDocument();
    expect(within(editor).queryByText('Colour')).not.toBeInTheDocument();
    expect(within(editor).queryByText('Font')).not.toBeInTheDocument();
    expect(within(editor).queryByText('Maximum text size')).not.toBeInTheDocument();
    expect(within(editor).getByRole('link', { name: 'Markdown help' })).toBeInTheDocument();

    const textarea = screen.getByRole('textbox', { name: 'Banner text' });
    expect(textarea).toHaveFocus();

    await user.type(textarea, 'First line{enter}Second line');
    textarea.blur();
    expect(onStateChange).not.toHaveBeenCalled();

    await user.click(within(editor).getByRole('button', { name: 'Add text' }));

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
      text: 'First line\nSecond line'
    }));
    expect(screen.getAllByText('First line')).not.toHaveLength(0);
    expect(screen.getAllByText('Second line')).not.toHaveLength(0);
    const editButton = screen.getByRole('button', { name: 'Edit banner' });
    expect(editButton).toHaveClass('opacity-0', 'group-hover/banner:opacity-100', 'focus-visible:opacity-100');
    await waitFor(() => expect(editButton).toHaveFocus());
  });

  it('discards a draft with Cancel or Escape', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <TextBanner
        savedState={{ text: 'Keep this' }}
        onStateChange={onStateChange}
      />
    );

    const editButton = screen.getByRole('button', { name: 'Edit banner' });
    await user.click(editButton);
    const textarea = screen.getByRole('textbox', { name: 'Banner text' });
    await user.clear(textarea);
    await user.type(textarea, 'Discard this');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onStateChange).not.toHaveBeenCalled();
    expect(screen.getAllByText('Keep this')).not.toHaveLength(0);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit banner' })).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Edit banner' }));
    await user.clear(screen.getByRole('textbox', { name: 'Banner text' }));
    await user.type(screen.getByRole('textbox', { name: 'Banner text' }), 'Also discard');
    await user.keyboard('{Escape}');

    expect(onStateChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByText('Keep this')).not.toHaveLength(0);
  });

  it('supports the save shortcut while plain Enter remains a newline', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(<TextBanner onStateChange={onStateChange} />);

    await user.click(screen.getByRole('button', { name: 'Add text' }));
    const textarea = screen.getByRole('textbox', { name: 'Banner text' });
    await user.type(textarea, 'One{enter}Two');

    expect(onStateChange).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('One\nTwo');

    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ text: 'One\nTwo' }));
  });

  it('opens from the keyboard and lets an existing banner be cleared explicitly', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(<TextBanner savedState={{ text: 'Clear me' }} onStateChange={onStateChange} />);

    const editButton = screen.getByRole('button', { name: 'Edit banner' });
    editButton.focus();
    await user.keyboard('{Enter}');

    const textarea = screen.getByRole('textbox', { name: 'Banner text' });
    await user.clear(textarea);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ text: '' }));
    expect(screen.getByRole('button', { name: 'Add text' })).toBeInTheDocument();
  });

  it('cycles preset colours from the displayed banner while editor choices remain transactional', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <TextBanner
        savedState={{ text: 'Do now', colorIndex: 0 }}
        onStateChange={onStateChange}
      />
    );

    const visibleText = screen.getAllByText('Do now').find(element => !element.closest('[aria-hidden="true"]'));
    expect(visibleText).toBeDefined();
    await user.click(visibleText!);
    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ colorIndex: 1 }));
    onStateChange.mockClear();

    const displayedSurface = visibleText!.closest('.cursor-pointer');
    expect(displayedSurface).not.toBeNull();
    fireEvent.mouseDown(displayedSurface!, { clientX: 10, clientY: 10 });
    fireEvent.click(displayedSurface!, { clientX: 30, clientY: 30 });
    expect(onStateChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Edit banner' }));
    await user.click(screen.getByRole('button', { name: 'Set banner colour to Sage' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('cycles a displayed custom colour back to the first preset', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <TextBanner
        savedState={{ text: 'Custom', colorIndex: 6, customColor: '#123456' }}
        onStateChange={onStateChange}
      />
    );

    const visibleText = screen.getAllByText('Custom').find(element => !element.closest('[aria-hidden="true"]'));
    await user.click(visibleText!);

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ colorIndex: 0 }));
  });

  it('offers an anchored RGB picker from a rainbow trigger as the final transactional colour choice', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const onPickerMouseDownBubble = vi.fn();
    render(
      <div onMouseDown={onPickerMouseDownBubble}>
        <TextBanner savedState={{ text: 'Custom colour' }} onStateChange={onStateChange} />
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Edit banner' }));
    const colourGroup = screen.getByRole('group', { name: 'Banner colour' });
    const customColourButton = within(colourGroup).getByRole('button', {
      name: 'Choose custom banner colour'
    });

    expect(colourGroup.lastElementChild).toBe(customColourButton);
    expect(customColourButton).toHaveAttribute('aria-haspopup', 'dialog');
    expect(customColourButton).toHaveAttribute('aria-expanded', 'false');
    expect(within(customColourButton).getByTestId('custom-colour-wheel'))
      .toHaveAttribute('data-visual', 'rainbow-ring');

    await user.click(customColourButton);
    expect(customColourButton).toHaveAttribute('aria-expanded', 'true');

    let picker = screen.getByRole('dialog', { name: 'Custom banner colour' });
    expect(within(picker).getByRole('slider', { name: 'Color' })).toBeInTheDocument();
    expect(picker).toHaveClass('no-drag');
    onPickerMouseDownBubble.mockClear();
    fireEvent.mouseDown(within(picker).getByRole('slider', { name: 'Color' }), {
      buttons: 1,
      clientX: 10,
      clientY: 10
    });
    expect(onPickerMouseDownBubble).not.toHaveBeenCalled();
    fireEvent.mouseUp(document);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Custom banner colour' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Banner text' })).toBeInTheDocument();
    expect(customColourButton).toHaveFocus();

    await user.click(customColourButton);
    picker = screen.getByRole('dialog', { name: 'Custom banner colour' });
    const hueSlider = within(picker).getByRole('slider', { name: 'Hue' });
    hueSlider.focus();
    fireEvent.keyDown(hueSlider, { key: 'ArrowRight', keyCode: 39, which: 39 });
    fireEvent.keyUp(hueSlider, { key: 'ArrowRight', keyCode: 39, which: 39 });
    expect(onStateChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
      colorIndex: 6,
      customColor: expect.stringMatching(/^#[0-9a-f]{6}$/)
    }));
    expect(onStateChange.mock.calls[0][0].customColor).not.toBe('#7c3aed');
  });

  it('migrates the legacy instructional sentinel to an empty banner', () => {
    render(<TextBanner savedState={{ text: 'Double-click to edit' }} />);

    expect(screen.queryByText('Double-click to edit')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add text' })).toBeInTheDocument();
  });

  it('temporarily expands a short column banner while editing', async () => {
    workspaceMock.layoutFormat = 'column';
    const user = userEvent.setup();
    render(<TextBanner savedState={{ text: 'Column banner', columnHeight: 60 }} />);

    const widget = screen.getByRole('button', { name: 'Edit banner' }).closest('.widget-container-custom-surface');
    expect(widget).toHaveStyle({ height: '60px' });

    await user.click(screen.getByRole('button', { name: 'Edit banner' }));
    expect(widget).toHaveStyle({ height: '260px' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit banner' }).closest('.widget-container-custom-surface'))
      .toHaveStyle({ height: '60px' });
  });

  it('enforces the editor-sized minimum in canvas and compact-panel hosts', () => {
    const config = widgetRegistry.get(WidgetType.TEXT_BANNER);

    expect(config?.minSize).toEqual({ width: 300, height: 260 });
    expect(config?.compactPanel?.minimumSize).toEqual({ width: 300, height: 260 });
  });
});
