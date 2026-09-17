import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SelectionActionBar } from '../SelectionActionBar';
import { useSelectionStore } from '../../../stores/selectionStore';
import { useItemStore } from '../../../stores/itemStore';

describe('SelectionActionBar component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSelectionStore.getState().clearSelection();
    useItemStore.setState({
      items: [
        {
          id: 'item-1',
          type: 'note',
          title: 'Test Note 1',
          excerpt: 'Content 1',
          pinned: false,
          archived: false,
          trashed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
          task: null,
          link: null,
          attachmentsCount: 0,
          thumbnailUrl: null,
        },
      ],
      archiveItems: [],
      trashItems: [],
    });
  });

  it('renders null when selectedCount is 0 without hook errors', () => {
    const { container } = render(<SelectionActionBar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders action bar when items are selected and handles transition without React Error #310', () => {
    const { container, rerender } = render(<SelectionActionBar />);
    expect(container.firstChild).toBeNull();

    // Select an item
    act(() => {
      useSelectionStore.getState().toggleSelectItem('item-1');
    });

    rerender(<SelectionActionBar />);

    // Must show selected badge
    expect(screen.getByText('selected')).toBeTruthy();
    expect(screen.getByText('Chat Context')).toBeTruthy();
    expect(screen.getByText('Workbench')).toBeTruthy();

    // Deselect item
    act(() => {
      useSelectionStore.getState().clearSelection();
    });

    rerender(<SelectionActionBar />);
    expect(container.firstChild).toBeNull();
  });
});
