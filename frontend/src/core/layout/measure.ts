// ============================================================
// Text Measurement using Canvas API
// ============================================================

import type { TextMetrics } from './types';

/** Cache for text measurements */
const measurementCache = new Map<string, TextMetrics>();

/** Canvas context for measurement (created once) */
let measureCanvas: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCanvas) {
    const canvas = document.createElement('canvas');
    measureCanvas = canvas.getContext('2d')!;
  }
  return measureCanvas;
}

/**
 * Measure text width and height using Canvas API
 */
export function measureText(
  text: string,
  fontFamily: string,
  fontSize: number,
  bold: boolean = false,
  italic: boolean = false
): TextMetrics {
  const cacheKey = `${fontFamily}:${fontSize}:${bold}:${italic}:${text}`;
  const cached = measurementCache.get(cacheKey);
  if (cached) return cached;

  const ctx = getMeasureContext();
  const fontStyle = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
  ctx.font = fontStyle;

  const metrics = ctx.measureText(text);
  const height = fontSize * 1.2; // Approximate line height

  const result: TextMetrics = {
    width: metrics.width,
    height,
  };

  measurementCache.set(cacheKey, result);
  return result;
}

/**
 * Clear the measurement cache
 */
export function clearMeasurementCache(): void {
  measurementCache.clear();
}

/**
 * Split text into words, preserving spaces
 */
export function splitIntoWords(text: string): string[] {
  const words: string[] = [];
  let current = '';

  for (const char of text) {
    if (char === ' ' || char === '\t') {
      if (current) {
        words.push(current);
        current = '';
      }
      words.push(char);
    } else if (char === '\n') {
      if (current) {
        words.push(current);
        current = '';
      }
      words.push('\n');
    } else {
      current += char;
    }
  }

  if (current) {
    words.push(current);
  }

  return words;
}

/**
 * Measure a word's width
 */
export function measureWord(
  word: string,
  fontFamily: string,
  fontSize: number,
  bold: boolean = false,
  italic: boolean = false
): number {
  return measureText(word, fontFamily, fontSize, bold, italic).width;
}
