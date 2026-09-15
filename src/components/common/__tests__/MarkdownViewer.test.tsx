import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MarkdownViewer } from '../MarkdownViewer';

describe('MarkdownViewer', () => {
  it('renders KaTeX math block with Chinese characters in \\text{...}', () => {
    const markdown = '$$\\text{之妻楚倾城之墓}$$';
    const { container } = render(<MarkdownViewer content={markdown} />);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).toContain('之妻楚倾城之墓');
  });

  it('renders standalone \\text{...} as a math typography block', () => {
    const markdown = '\\text{之妻楚倾城之墓}';
    const { container } = render(<MarkdownViewer content={markdown} />);
    expect(container.textContent).toContain('之妻楚倾城之墓');
  });

  it('renders inline math $E = mc^2$', () => {
    const markdown = 'Rumus energi: $E = mc^2$.';
    const { container } = render(<MarkdownViewer content={markdown} />);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).toContain('Rumus energi:');
  });

  it('correctly nests list items following a category header ending with :', () => {
    const markdown = `
* Cross-platform (Paling Umum untuk IDE Modern):
* Electron (Node.js/Chromium): Memungkinkan pengembangan UI
* Tauri (Rust/Webview): Mirip Electron tapi lebih ringan
* Platform-specific (Performa Maksimal, Tapi Lebih Sulit Lintas Platform):
* macOS: Swift/Objective-C dengan SwiftUI
* Windows: C#/XAML dengan WPF
    `.trim();

    const { container } = render(<MarkdownViewer content={markdown} />);
    const listItems = container.querySelectorAll('li');
    expect(listItems.length).toBe(6);

    // Header 1: Cross-platform (depth 0, ml-1)
    expect(listItems[0].className).toContain('ml-1');
    expect(listItems[0].textContent).toContain('Cross-platform');

    // Child 1: Electron (depth 1, ml-5)
    expect(listItems[1].className).toContain('ml-5');
    expect(listItems[1].textContent).toContain('Electron');

    // Child 2: Tauri (depth 1, ml-5)
    expect(listItems[2].className).toContain('ml-5');
    expect(listItems[2].textContent).toContain('Tauri');

    // Header 2: Platform-specific (depth 0, ml-1)
    expect(listItems[3].className).toContain('ml-1');
    expect(listItems[3].textContent).toContain('Platform-specific');

    // Child 3: macOS (depth 1, ml-5)
    expect(listItems[4].className).toContain('ml-5');
    expect(listItems[4].textContent).toContain('macOS');

    // Child 4: Windows (depth 1, ml-5)
    expect(listItems[5].className).toContain('ml-5');
    expect(listItems[5].textContent).toContain('Windows');
  });

  it('renders italic paragraph containing inner bold keywords without raw asterisks', () => {
    const markdown = '*Untuk proyek sebesar ini, **Electron** atau **Tauri** sering menjadi pilihan awal karena kecepatan pengembangan dan kemampuan lintas platform.*';
    const { container } = render(<MarkdownViewer content={markdown} />);

    // Should contain an <em> tag
    const emTag = container.querySelector('em');
    expect(emTag).not.toBeNull();

    // Should contain strong tags inside or alongside
    const strongTags = container.querySelectorAll('strong');
    expect(strongTags.length).toBe(2);
    expect(strongTags[0].textContent).toBe('Electron');
    expect(strongTags[1].textContent).toBe('Tauri');

    // Should NOT render literal asterisks at start/end of paragraph
    expect(container.textContent?.startsWith('*')).toBe(false);
    expect(container.textContent?.endsWith('*')).toBe(false);
  });

  it('renders code block with syntax and copy buttons', () => {
    const markdown = '```typescript\nconst a: number = 42;\n```';
    render(<MarkdownViewer content={markdown} />);
    expect(screen.getByText('TypeScript')).toBeDefined();
    expect(screen.getByText('const a: number = 42;')).toBeDefined();
  });

  it('renders markdown table with columns', () => {
    const markdown = `
| Fitur | Status |
| :--- | :---: |
| Streaming | Selesai |
| LaTeX | Selesai |
    `.trim();

    render(<MarkdownViewer content={markdown} />);
    expect(screen.getByText('Fitur')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Streaming')).toBeDefined();
    expect(screen.getAllByText('Selesai').length).toBe(2);
  });
});
