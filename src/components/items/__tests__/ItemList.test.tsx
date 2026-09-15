// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemList } from '../ItemList';
import { ItemSummary } from '../../../types/item';

describe('ItemList component', () => {
  const onSelect = vi.fn();
  const onToggleTask = vi.fn();
  const onToggleFavorite = vi.fn();
  const onTrash = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty message when items list is empty', () => {
    render(
      <ItemList
        items={[]}
        onSelect={onSelect}
        emptyMessage="No items found"
      />
    );

    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText(/Capture notes, tasks, or drop attachments/i)).toBeInTheDocument();
  });

  it('renders items in flat mode', () => {
    const mockItems: ItemSummary[] = [
      {
        id: 'item-1',
        type: 'task',
        title: 'Task Alpha',
        excerpt: 'Alpha description',
        pinned: false,
        archived: false,
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        task: { priority: 'urgent', completed: false, dueDate: null },
        link: null,
        attachmentsCount: 0,
        thumbnailUrl: null,
      },
      {
        id: 'item-2',
        type: 'note',
        title: 'Note Beta',
        excerpt: 'Beta content',
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
    ];

    render(
      <ItemList
        items={mockItems}
        onSelect={onSelect}
        onToggleTask={onToggleTask}
        onToggleFavorite={onToggleFavorite}
        onTrash={onTrash}
        groupByDate={false}
      />
    );

    expect(screen.getByText('Task Alpha')).toBeInTheDocument();
    expect(screen.getByText('Note Beta')).toBeInTheDocument();
  });

  it('renders grouped items with accordion headers and supports collapse/expand', () => {
    const now = new Date();
    const todayIso = now.toISOString();
    const earlierDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const mockItems: ItemSummary[] = [
      {
        id: 'item-today',
        type: 'task',
        title: 'Today Task',
        excerpt: 'Today description',
        pinned: false,
        archived: false,
        trashed: false,
        createdAt: todayIso,
        updatedAt: todayIso,
        tags: [],
        task: { priority: 'medium', completed: false, dueDate: null },
        link: null,
        attachmentsCount: 0,
        thumbnailUrl: null,
      },
      {
        id: 'item-earlier',
        type: 'note',
        title: 'Earlier Note',
        excerpt: 'Earlier content',
        pinned: false,
        archived: false,
        trashed: false,
        createdAt: earlierDate,
        updatedAt: earlierDate,
        tags: [],
        task: null,
        link: null,
        attachmentsCount: 0,
        thumbnailUrl: null,
      },
    ];

    render(
      <ItemList
        items={mockItems}
        onSelect={onSelect}
        onToggleTask={onToggleTask}
        onToggleFavorite={onToggleFavorite}
        onTrash={onTrash}
        groupByDate={true}
      />
    );

    // Group headers should be rendered
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();

    // Today task should be visible
    expect(screen.getByText('Today Task')).toBeInTheDocument();

    // By default, 'earlier' is collapsed, so 'Earlier Note' should NOT be in DOM
    expect(screen.queryByText('Earlier Note')).not.toBeInTheDocument();

    // Click 'Earlier' accordion header to expand it
    const earlierHeaderBtn = screen.getByText('Earlier').closest('button');
    expect(earlierHeaderBtn).not.toBeNull();
    fireEvent.click(earlierHeaderBtn!);

    // Now 'Earlier Note' should be visible
    expect(screen.getByText('Earlier Note')).toBeInTheDocument();

    // Click 'Earlier' again to collapse
    fireEvent.click(earlierHeaderBtn!);
    expect(screen.queryByText('Earlier Note')).not.toBeInTheDocument();
  });
});
