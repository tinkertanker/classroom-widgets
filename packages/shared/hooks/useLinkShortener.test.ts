import { act, renderHook } from '@testing-library/react';
import { useLinkShortener } from './useWorkspace';
import { useWorkspaceStore } from '@/store/workspaceStore.simple';

afterEach(() => {
  delete window.__CLASSROOM_WIDGETS_MACOS__;
  delete window.classroomShortenerSettings;
});

test('Mac panels use native preferences, including live changes and remounts, rather than local storage', () => {
  useWorkspaceStore.getState().updateLinkShortener({ provider: 'tinyurl' });
  window.__CLASSROOM_WIDGETS_MACOS__ = true;
  window.classroomShortenerSettings = { provider: 'shortio', shortioApiKey: 'pk_test', shortioDomain: 'go.school.edu' };
  const first = renderHook(() => useLinkShortener());
  expect(first.result.current.settings.provider).toBe('shortio');
  expect(first.result.current.settings.shortioDomain).toBe('go.school.edu');
  act(() => {
    window.classroomShortenerSettings = { ...window.classroomShortenerSettings!, provider: 'spoo' };
    window.dispatchEvent(new Event('classroom-shortener-settings-changed'));
  });
  expect(first.result.current.settings.provider).toBe('spoo');
  first.unmount();
  const second = renderHook(() => useLinkShortener());
  expect(second.result.current.settings.provider).toBe('spoo');
  expect(useWorkspaceStore.getState().linkShortener.provider).toBe('tinyurl');
});
