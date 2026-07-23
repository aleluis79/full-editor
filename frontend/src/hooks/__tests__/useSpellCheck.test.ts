import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellCheckStore } from '../../stores/spell-check-store';
import { useDocumentStore } from '../../stores/document-store';

// Mock the API client
vi.mock('../../api/client', () => ({
  fetchCustomWords: vi.fn().mockResolvedValue([
    { id: '1', user_id: 'u1', word: 'opencode', lang: 'en', created_at: '' },
  ]),
  addCustomWord: vi.fn().mockResolvedValue({ id: '2', user_id: 'u1', word: 'nspell', lang: 'en', created_at: '' }),
  deleteCustomWord: vi.fn(),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      languages: ['en'],
    },
  }),
}));

// Mock Worker — must be a class (constructible)
const mockWorkerInstances: Array<{
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
}> = [];

class WorkerMock {
  postMessage = vi.fn();
  terminate = vi.fn();
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;

  constructor(_url: string | URL, _opts?: WorkerOptions) {
    mockWorkerInstances.push(this);
  }
}

const originalWorker = globalThis.Worker;

beforeEach(() => {
  mockWorkerInstances.length = 0;
  globalThis.Worker = WorkerMock as unknown as typeof Worker;

  useSpellCheckStore.setState({
    enabled: true,
    misspellings: {},
    customWords: [],
    popover: null,
  });

  useDocumentStore.setState({
    document: {
      id: 'doc-1',
      type: 'doc',
      children: [
        {
          id: 'block-1',
          type: 'paragraph',
          children: [{ id: 'r1', content: 'This is a tset', marks: [] }],
        },
      ],
    },
    currentDocId: 'doc-1',
    documentTitle: 'Test',
    isDirty: false,
    isSaving: false,
  });
});

afterEach(() => {
  globalThis.Worker = originalWorker;
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('useSpellCheck', () => {
  it('initializes custom words from API on mount', async () => {
    const { fetchCustomWords } = await import('../../api/client');
    const { useSpellCheck } = await import('../useSpellCheck');
    renderHook(() => useSpellCheck());

    await vi.waitFor(() => {
      expect(fetchCustomWords).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      const state = useSpellCheckStore.getState();
      expect(state.customWords).toContain('opencode');
    });
  });

  it('respects enabled state — does not fetch when disabled', async () => {
    useSpellCheckStore.setState({ enabled: false });
    const { fetchCustomWords } = await import('../../api/client');

    const { useSpellCheck } = await import('../useSpellCheck');
    renderHook(() => useSpellCheck());

    await new Promise((r) => setTimeout(r, 100));
    expect(fetchCustomWords).not.toHaveBeenCalled();
  });

  it('creates a Worker when enabled', async () => {
    const { useSpellCheck } = await import('../useSpellCheck');
    renderHook(() => useSpellCheck());

    expect(mockWorkerInstances.length).toBeGreaterThanOrEqual(1);
  });

  it('terminates Worker when disabled', async () => {
    const { useSpellCheck } = await import('../useSpellCheck');
    const { rerender, unmount } = renderHook(() => useSpellCheck());

    const worker = mockWorkerInstances[0];
    expect(worker).toBeDefined();

    // Disable spell check
    act(() => {
      useSpellCheckStore.setState({ enabled: false });
    });

    // Rerender to trigger effect cleanup
    rerender();

    expect(worker.terminate).toHaveBeenCalled();

    unmount();
  });

  it('addToDictionary calls API and updates store', async () => {
    // Verify store addCustomWord works directly first
    useSpellCheckStore.setState({ customWords: [] });
    useSpellCheckStore.getState().addCustomWord('nspell');
    expect(useSpellCheckStore.getState().customWords).toEqual(['nspell']);

    // Reset for hook test
    useSpellCheckStore.setState({ customWords: [] });

    const { addCustomWord } = await import('../../api/client');

    const { useSpellCheck } = await import('../useSpellCheck');
    const { result } = renderHook(() => useSpellCheck());

    // Wait for initial fetch to populate customWords
    await vi.waitFor(() => {
      expect(useSpellCheckStore.getState().customWords).toEqual(['opencode']);
    });

    // Try calling addToDictionary
    await act(async () => {
      await result.current.addToDictionary('nspell');
    });

    expect(addCustomWord).toHaveBeenCalledWith('nspell', 'en');

    // Check if addToDictionary actually updated the store
    const state = useSpellCheckStore.getState();
    expect(state.customWords).toContain('opencode');
    expect(state.customWords).toContain('nspell');
  });

  it('worker processes check result messages', async () => {
    const { useSpellCheck } = await import('../useSpellCheck');
    renderHook(() => useSpellCheck());

    const worker = mockWorkerInstances[0];
    expect(worker).toBeDefined();

    // Simulate worker sending a result with misspellings
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: {
          type: 'result',
          payload: [
            {
              blockId: 'block-1',
              misspellings: [
                { word: 'tset', start: 10, end: 14, suggestions: ['test', 'set'] },
              ],
            },
          ],
        },
      }));
    });

    const state = useSpellCheckStore.getState();
    expect(state.misspellings['block-1']).toHaveLength(1);
    expect(state.misspellings['block-1'][0].word).toBe('tset');
  });
});
