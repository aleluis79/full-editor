import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from '../Icon';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Link,
  Image,
  Table,
  ListUl,
  ListOl,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ClearFormatting,
  Save,
  Pdf,
  Back,
  Plus,
  Delete,
  ColorPicker,
  HighlightPicker,
} from '../index';

describe('Icon base component', () => {
  it('renders an SVG element with default 24x24 viewBox', () => {
    const { container } = render(
      <Icon><path d="M0 0h24v24H0z" /></Icon>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('width')).toBe('24');
    expect(svg!.getAttribute('height')).toBe('24');
    expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg!.getAttribute('fill')).toBe('none');
    expect(svg!.getAttribute('stroke')).toBe('currentColor');
  });

  it('accepts a custom size prop', () => {
    const { container } = render(
      <Icon size={32}><path d="M0 0h24v24H0z" /></Icon>,
    );
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('32');
    expect(svg!.getAttribute('height')).toBe('32');
  });

  it('accepts a className prop', () => {
    const { container } = render(
      <Icon className="my-icon"><path d="M0 0h24v24H0z" /></Icon>,
    );
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('class')).toBe('my-icon');
  });

  it('renders child path elements inside the SVG', () => {
    const { container } = render(
      <Icon>
        <path d="M12 2L2 7l10 5 10-5z" />
        <path d="M2 17l10 5 10-5" />
      </Icon>,
    );
    const svg = container.querySelector('svg');
    expect(svg!.querySelectorAll('path')).toHaveLength(2);
  });
});

describe('Text formatting icons', () => {
  it('Bold renders an SVG with path elements', () => {
    const { container } = render(<Bold />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll('*').length).toBeGreaterThan(0);
  });

  it('Italic renders an SVG with elements', () => {
    const { container } = render(<Italic />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll('line, path').length).toBeGreaterThan(0);
  });

  it('Underline renders an SVG with elements', () => {
    const { container } = render(<Underline />);
    expect(container.querySelector('svg')!.querySelectorAll('*').length).toBeGreaterThan(0);
  });

  it('Strikethrough renders an SVG with elements', () => {
    const { container } = render(<Strikethrough />);
    expect(container.querySelector('svg')!.querySelectorAll('*').length).toBeGreaterThan(0);
  });

  it('Superscript renders an SVG with elements', () => {
    const { container } = render(<Superscript />);
    expect(container.querySelector('svg')!.querySelectorAll('*').length).toBeGreaterThan(0);
  });

  it('Subscript renders an SVG with elements', () => {
    const { container } = render(<Subscript />);
    expect(container.querySelector('svg')!.querySelectorAll('*').length).toBeGreaterThan(0);
  });
});

describe('Action icons', () => {
  it('Back renders an SVG', () => {
    const { container } = render(<Back />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('Save renders an SVG', () => {
    const { container } = render(<Save />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('Link renders an SVG', () => {
    const { container } = render(<Link />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('ClearFormatting renders an SVG', () => {
    const { container } = render(<ClearFormatting />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('Image renders an SVG', () => {
    const { container } = render(<Image />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('Table renders an SVG', () => {
    const { container } = render(<Table />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('Pdf renders an SVG', () => {
    const { container } = render(<Pdf />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('Plus renders an SVG', () => {
    const { container } = render(<Plus />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('Delete renders an SVG', () => {
    const { container } = render(<Delete />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('Alignment icons', () => {
  it('AlignLeft renders an SVG', () => {
    const { container } = render(<AlignLeft />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('AlignCenter renders an SVG', () => {
    const { container } = render(<AlignCenter />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('AlignRight renders an SVG', () => {
    const { container } = render(<AlignRight />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('List icons', () => {
  it('ListUl renders an SVG', () => {
    const { container } = render(<ListUl />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('ListOl renders an SVG', () => {
    const { container } = render(<ListOl />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('Color icons', () => {
  it('ColorPicker renders an SVG', () => {
    const { container } = render(<ColorPicker />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('HighlightPicker renders an SVG', () => {
    const { container } = render(<HighlightPicker />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('Icons accept className and size props', () => {
  it('Bold accepts className', () => {
    const { container } = render(<Bold className="custom-icon" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toBe('custom-icon');
  });

  it('Bold accepts size', () => {
    const { container } = render(<Bold size={32} />);
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('32');
  });

  it('Delete accepts className', () => {
    const { container } = render(<Delete className="del-icon" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toBe('del-icon');
  });
});
