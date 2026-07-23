import { describe, it, expect, beforeEach } from 'vitest';
import { useSpellCheckStore } from '../spell-check-store';
import type { Misspelling } from '../spell-check-store';

describe('spell-check-store', () => {
  beforeEach(() => {
    useSpellCheckStore.setState({
      enabled: true,
      misspellings: {},
      customWords: [],
      popover: null,
    });
  });

  it('toggles enabled state', () => {
    expect(useSpellCheckStore.getState().enabled).toBe(true);
    useSpellCheckStore.getState().toggle();
    expect(useSpellCheckStore.getState().enabled).toBe(false);
    useSpellCheckStore.getState().toggle();
    expect(useSpellCheckStore.getState().enabled).toBe(true);
  });

  it('sets misspellings for a block', () => {
    const misspellings: Misspelling[] = [
      { word: 'Ths', start: 0, end: 3, suggestions: ['This', 'The'] },
    ];
    useSpellCheckStore.getState().setMisspellings('block-1', misspellings);
    expect(useSpellCheckStore.getState().misspellings['block-1']).toEqual(misspellings);
  });

  it('clears misspellings for a single block', () => {
    useSpellCheckStore.getState().setMisspellings('block-1', [
      { word: 'Ths', start: 0, end: 3, suggestions: ['This'] },
    ]);
    useSpellCheckStore.getState().clearBlock('block-1');
    expect(useSpellCheckStore.getState().misspellings['block-1']).toBeUndefined();
  });

  it('clears all misspellings when toggling off', () => {
    useSpellCheckStore.getState().setMisspellings('block-1', [
      { word: 'Ths', start: 0, end: 3, suggestions: ['This'] },
    ]);
    useSpellCheckStore.getState().toggle();
    expect(useSpellCheckStore.getState().misspellings).toEqual({});
    expect(useSpellCheckStore.getState().enabled).toBe(false);
  });

  it('shows and hides popover', () => {
    useSpellCheckStore.getState().showPopover({
      blockId: 'block-1',
      start: 0,
      end: 3,
      suggestions: ['This', 'The'],
    });
    const popover = useSpellCheckStore.getState().popover;
    expect(popover).not.toBeNull();
    expect(popover!.blockId).toBe('block-1');
    expect(popover!.suggestions).toEqual(['This', 'The']);

    useSpellCheckStore.getState().hidePopover();
    expect(useSpellCheckStore.getState().popover).toBeNull();
  });

  it('sets custom words', () => {
    useSpellCheckStore.getState().setCustomWords(['opencode', 'typescript']);
    expect(useSpellCheckStore.getState().customWords).toEqual(['opencode', 'typescript']);
  });

  it('adds custom word', () => {
    useSpellCheckStore.getState().setCustomWords(['opencode']);
    useSpellCheckStore.getState().addCustomWord('typescript');
    expect(useSpellCheckStore.getState().customWords).toContain('opencode');
    expect(useSpellCheckStore.getState().customWords).toContain('typescript');
  });
});
