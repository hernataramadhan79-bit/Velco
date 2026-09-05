import { useState, useEffect, useCallback } from 'react';
import { Tag } from '../types/item';
import { db } from '../services/database';

export function useTagStore() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshTags = useCallback(async () => {
    setLoading(true);
    try {
      const list = await db.getTags();
      setTags(list);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTags();
  }, [refreshTags]);

  const addTag = async (name: string, color?: string): Promise<Tag> => {
    const newTag = await db.createTag(name, color);
    await refreshTags();
    return newTag;
  };

  const removeTag = async (id: string): Promise<void> => {
    await db.deleteTag(id);
    if (selectedTagId === id) setSelectedTagId(null);
    await refreshTags();
  };

  return {
    tags,
    selectedTagId,
    setSelectedTagId,
    refreshTags,
    addTag,
    removeTag,
    loading,
  };
}
