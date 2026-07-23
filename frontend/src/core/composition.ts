/**
 * Global IME composition flag.
 *
 * Set to true during IME composition (compositionStart → compositionEnd).
 * The spell check hook reads this flag to avoid triggering checks while
 * the user is composing CJK/dead-key input.
 */
let _isComposing = false;

export function setComposing(v: boolean) {
  _isComposing = v;
}

export function isComposing(): boolean {
  return _isComposing;
}
