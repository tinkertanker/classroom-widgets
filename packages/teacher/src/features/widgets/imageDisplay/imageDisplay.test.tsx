import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
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
});
