import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ImageDisplay from './imageDisplay';
import { loadImage, storeImage, deleteImage } from '../../../services/imageStorage';

vi.mock('../../../services/imageStorage', () => ({
  storeImage: vi.fn(),
  loadImage: vi.fn(),
  deleteImage: vi.fn()
}));

type StoreCall = {
  key: string;
  dataUrl: string;
  resolve: () => void;
};

class MockFileReader {
  static EMPTY = 0;
  static LOADING = 1;
  static DONE = 2;

  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onloadend: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onabort: ((event: ProgressEvent<FileReader>) => void) | null = null;
  readyState = MockFileReader.EMPTY;
  result: string | ArrayBuffer | null = null;

  readAsDataURL() {
    this.readyState = MockFileReader.LOADING;
    readers.push(this);
  }

  abort() {
    this.readyState = MockFileReader.DONE;
    this.onabort?.(new ProgressEvent('abort') as ProgressEvent<FileReader>);
    this.onloadend?.(new ProgressEvent('loadend') as ProgressEvent<FileReader>);
  }

  finish(dataUrl: string) {
    this.readyState = MockFileReader.DONE;
    this.result = dataUrl;
    this.onload?.({ target: { result: dataUrl } } as ProgressEvent<FileReader>);
    this.onloadend?.(new ProgressEvent('loadend') as ProgressEvent<FileReader>);
  }
}

let readers: MockFileReader[];
let storeCalls: StoreCall[];

describe('ImageDisplay', () => {
  beforeEach(() => {
    readers = [];
    storeCalls = [];
    vi.stubGlobal('FileReader', MockFileReader);
    vi.mocked(loadImage).mockResolvedValue(null);
    vi.mocked(deleteImage).mockResolvedValue();
    vi.mocked(storeImage).mockImplementation((key: string, dataUrl: string) => (
      new Promise<void>(resolve => {
        storeCalls.push({ key, dataUrl, resolve });
      })
    ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test('ignores an older image store that completes after a newer selection', async () => {
    const onStateChange = vi.fn();
    const { container } = render(<ImageDisplay widgetId="widget-1" onStateChange={onStateChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['first'], 'first.png', { type: 'image/png' })] }
    });
    readers[0].finish('data:image/png;base64,first');

    fireEvent.change(input, {
      target: { files: [new File(['second'], 'second.png', { type: 'image/png' })] }
    });
    readers[1].finish('data:image/png;base64,second');

    await act(async () => {
      storeCalls[1].resolve();
    });

    expect(screen.getByAltText('Display')).toHaveAttribute('src', 'data:image/png;base64,second');
    expect(onStateChange).toHaveBeenCalledWith({ imageKey: storeCalls[1].key });

    await act(async () => {
      storeCalls[0].resolve();
    });

    expect(screen.getByAltText('Display')).toHaveAttribute('src', 'data:image/png;base64,second');
    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(deleteImage).toHaveBeenCalledWith(storeCalls[0].key);
  });

  test('best-effort deletes the previous key after a successful replacement', async () => {
    const onStateChange = vi.fn();
    const { container } = render(<ImageDisplay widgetId="widget-1" onStateChange={onStateChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['first'], 'first.png', { type: 'image/png' })] }
    });
    readers[0].finish('data:image/png;base64,first');

    await act(async () => {
      storeCalls[0].resolve();
    });

    fireEvent.change(input, {
      target: { files: [new File(['second'], 'second.png', { type: 'image/png' })] }
    });
    readers[1].finish('data:image/png;base64,second');

    await act(async () => {
      storeCalls[1].resolve();
    });

    expect(screen.getByAltText('Display')).toHaveAttribute('src', 'data:image/png;base64,second');
    expect(deleteImage).toHaveBeenCalledWith(storeCalls[0].key);
  });

  test('ignores and cleans up a pending image store after unmount', async () => {
    const onStateChange = vi.fn();
    const { container, unmount } = render(<ImageDisplay widgetId="widget-1" onStateChange={onStateChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['image'], 'image.png', { type: 'image/png' })] }
    });
    readers[0].finish('data:image/png;base64,image');

    unmount();

    await act(async () => {
      storeCalls[0].resolve();
    });

    expect(onStateChange).not.toHaveBeenCalled();
    expect(deleteImage).toHaveBeenCalledWith(storeCalls[0].key);
  });

  test('shows an error when loading a saved image fails', async () => {
    vi.mocked(loadImage).mockRejectedValueOnce(new Error('load failed'));

    render(<ImageDisplay savedState={{ imageKey: 'stored-image' }} />);

    expect(await screen.findByText('Unable to load image. Please try again.')).toBeInTheDocument();
  });

  test('shows legacy image without emitting state when migration store fails', async () => {
    const onStateChange = vi.fn();
    vi.mocked(storeImage).mockRejectedValueOnce(new Error('store failed'));

    render(
      <ImageDisplay
        widgetId="widget-1"
        savedState={{ imageUrl: 'data:image/png;base64,legacy' }}
        onStateChange={onStateChange}
      />
    );

    expect(await screen.findByAltText('Display')).toHaveAttribute('src', 'data:image/png;base64,legacy');
    expect(await screen.findByText('Unable to save image. Please try again.')).toBeInTheDocument();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  test('shows an error and skips state change when selected image store fails', async () => {
    const onStateChange = vi.fn();
    vi.mocked(storeImage).mockRejectedValueOnce(new Error('store failed'));
    const { container } = render(<ImageDisplay widgetId="widget-1" onStateChange={onStateChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['image'], 'image.png', { type: 'image/png' })] }
    });

    await act(async () => {
      readers[0].finish('data:image/png;base64,image');
    });

    expect(await screen.findByText('Unable to save image. Please try again.')).toBeInTheDocument();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  test('reloads the image when the persisted key changes externally', async () => {
    const onStateChange = vi.fn();
    vi.mocked(loadImage).mockImplementation(async (key: string) => `data:image/png;base64,${key}`);

    const { rerender } = render(
      <ImageDisplay widgetId="widget-1" savedState={{ imageKey: 'first-key' }} onStateChange={onStateChange} />
    );

    expect(await screen.findByAltText('Display')).toHaveAttribute('src', 'data:image/png;base64,first-key');

    rerender(
      <ImageDisplay widgetId="widget-1" savedState={{ imageKey: 'second-key' }} onStateChange={onStateChange} />
    );

    await waitFor(() => {
      expect(screen.getByAltText('Display')).toHaveAttribute('src', 'data:image/png;base64,second-key');
    });
    // Adopting an external key is not an edit, so it must not be echoed back.
    expect(onStateChange).not.toHaveBeenCalled();
  });

  test('ignores a load that a newer persisted key superseded', async () => {
    const pendingLoads = new Map<string, (url: string | null) => void>();
    vi.mocked(loadImage).mockImplementation((key: string) => (
      new Promise<string | null>(resolve => {
        pendingLoads.set(key, resolve);
      })
    ));

    const { rerender } = render(<ImageDisplay widgetId="widget-1" savedState={{ imageKey: 'slow-key' }} />);

    rerender(<ImageDisplay widgetId="widget-1" savedState={{ imageKey: 'newer-key' }} />);

    await act(async () => {
      pendingLoads.get('newer-key')?.('data:image/png;base64,newer');
    });

    expect(screen.getByAltText('Display')).toHaveAttribute('src', 'data:image/png;base64,newer');

    await act(async () => {
      pendingLoads.get('slow-key')?.('data:image/png;base64,slow');
    });

    expect(screen.getByAltText('Display')).toHaveAttribute('src', 'data:image/png;base64,newer');
  });

  test('clears the image when the persisted key is externally removed', async () => {
    vi.mocked(loadImage).mockImplementation(async (key: string) => `data:image/png;base64,${key}`);

    const { rerender } = render(<ImageDisplay widgetId="widget-1" savedState={{ imageKey: 'first-key' }} />);

    expect(await screen.findByAltText('Display')).toBeInTheDocument();

    rerender(<ImageDisplay widgetId="widget-1" savedState={{ imageKey: null }} />);

    await waitFor(() => {
      expect(screen.queryByAltText('Display')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Add an image')).toBeInTheDocument();
  });

  test('shows an error when an external key cannot be loaded from storage', async () => {
    vi.mocked(loadImage).mockImplementation(async (key: string) => (
      key === 'first-key' ? `data:image/png;base64,${key}` : null
    ));

    const { rerender } = render(
      <ImageDisplay widgetId="widget-1" savedState={{ imageKey: 'first-key' }} />
    );

    expect(await screen.findByAltText('Display')).toHaveAttribute('src', 'data:image/png;base64,first-key');

    rerender(<ImageDisplay widgetId="widget-1" savedState={{ imageKey: 'missing-key' }} />);

    expect(await screen.findByText('Unable to load image. Please try again.')).toBeInTheDocument();
    expect(screen.queryByAltText('Display')).not.toBeInTheDocument();
  });

  test('clears the previous image when an external key load throws', async () => {
    vi.mocked(loadImage).mockImplementation(async (key: string) => {
      if (key === 'first-key') return `data:image/png;base64,${key}`;
      throw new Error('idb unavailable');
    });

    const { rerender } = render(
      <ImageDisplay widgetId="widget-1" savedState={{ imageKey: 'first-key' }} />
    );

    expect(await screen.findByAltText('Display')).toHaveAttribute('src', 'data:image/png;base64,first-key');

    rerender(<ImageDisplay widgetId="widget-1" savedState={{ imageKey: 'broken-key' }} />);

    expect(await screen.findByText('Unable to load image. Please try again.')).toBeInTheDocument();
    expect(screen.queryByAltText('Display')).not.toBeInTheDocument();
  });

  test('shows an error when the initial saved image is missing from storage', async () => {
    vi.mocked(loadImage).mockResolvedValueOnce(null);

    render(<ImageDisplay savedState={{ imageKey: 'stored-image' }} />);

    expect(await screen.findByText('Unable to load image. Please try again.')).toBeInTheDocument();
    expect(screen.queryByAltText('Display')).not.toBeInTheDocument();
  });

  test('aborts active file reader and ignores file load callbacks after unmount', () => {
    const { container, unmount } = render(<ImageDisplay widgetId="widget-1" onStateChange={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['image'], 'image.png', { type: 'image/png' })] }
    });

    expect(readers[0].readyState).toBe(MockFileReader.LOADING);

    unmount();

    expect(readers[0].readyState).toBe(MockFileReader.DONE);

    readers[0].finish('data:image/png;base64,image');

    expect(storeImage).not.toHaveBeenCalled();
  });
});
