/**
 * Vitest setup — runs before all tests.
 * Mocks APIs unavailable in jsdom (Worker, etc.).
 */

// Mock Worker for jsdom — needed by Editor tests that mount useSpellCheck
class MockWorker implements Worker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;

  postMessage(_message: unknown, _transfer?: Transferable[]): void {
    // No-op in tests
  }

  terminate(): void {
    // No-op in tests
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }
}

globalThis.Worker = MockWorker as unknown as typeof Worker;
