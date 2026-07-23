import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineHeaderFooterEditor } from '../InlineHeaderFooterEditor';
import type { TextRun } from '../../core/types';

function makeRun(content: string, marks: string[] = []): TextRun {
  return {
    id: `run-${content}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'text',
    content,
    marks: marks as TextRun['marks'],
  };
}

const defaultProps = {
  target: 'header' as const,
  runs: [makeRun('Hello World')],
  area: { x: 96, y: 48, width: 602, height: 36 },
  isActive: false,
  pageNumber: 1,
  totalPages: 5,
  onActivate: vi.fn(),
  onChange: vi.fn(),
};

describe('InlineHeaderFooterEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an overlay with run content when inactive', () => {
    render(<InlineHeaderFooterEditor {...defaultProps} />);
    // Should display the text content
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('renders with correct positioning from area prop', () => {
    const { container } = render(<InlineHeaderFooterEditor {...defaultProps} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.position).toBe('absolute');
    expect(wrapper.style.left).toBe('96px');
    expect(wrapper.style.top).toBe('48px');
    expect(wrapper.style.width).toBe('602px');
    expect(wrapper.style.height).toBe('36px');
  });

  it('shows dashed border when active', () => {
    const { container } = render(
      <InlineHeaderFooterEditor {...defaultProps} isActive={true} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.borderStyle).toBe('dashed');
  });

  it('does not show dashed border when inactive', () => {
    const { container } = render(
      <InlineHeaderFooterEditor {...defaultProps} isActive={false} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.borderStyle).not.toBe('dashed');
  });

  it('calls onActivate when clicked', () => {
    render(<InlineHeaderFooterEditor {...defaultProps} />);
    const wrapper = screen.getByText('Hello World').closest('[data-testid="inline-hf-editor"]');
    fireEvent.click(wrapper!);
    expect(defaultProps.onActivate).toHaveBeenCalledTimes(1);
  });

  it('renders empty overlay when runs are empty', () => {
    render(<InlineHeaderFooterEditor {...defaultProps} runs={[]} />);
    // Should still render the editor area
    const editor = screen.getByTestId('inline-hf-editor');
    expect(editor).toBeTruthy();
  });

  it('renders multiple runs with their marks', () => {
    const runs = [
      makeRun('Bold', ['bold']),
      makeRun(' Normal'),
    ];
    render(<InlineHeaderFooterEditor {...defaultProps} runs={runs} />);
    const boldSpan = screen.getByText('Bold');
    expect(boldSpan.style.fontWeight).toBe('bold');
  });

  it('resolves tokens in the overlay display', () => {
    const runs = [makeRun('Page {pageNumber} of {totalPages}')];
    render(
      <InlineHeaderFooterEditor
        {...defaultProps}
        runs={runs}
        pageNumber={3}
        totalPages={10}
      />,
    );
    expect(screen.getByText('Page 3 of 10')).toBeTruthy();
  });

  it('shows textarea when active', () => {
    const { container } = render(
      <InlineHeaderFooterEditor {...defaultProps} isActive={true} />,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('does not show textarea when inactive', () => {
    const { container } = render(
      <InlineHeaderFooterEditor {...defaultProps} isActive={false} />,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeNull();
  });

  it('textarea contains raw run text (with unresolved tokens)', () => {
    const runs = [makeRun('Page {pageNumber}')];
    const { container } = render(
      <InlineHeaderFooterEditor
        {...defaultProps}
        runs={runs}
        isActive={true}
        pageNumber={3}
      />,
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Page {pageNumber}');
  });

  it('calls onChange when typing in textarea', () => {
    const runs = [makeRun('Hello')];
    const { container } = render(
      <InlineHeaderFooterEditor
        {...defaultProps}
        runs={runs}
        isActive={true}
      />,
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello World' } });
    expect(defaultProps.onChange).toHaveBeenCalled();
  });
});
