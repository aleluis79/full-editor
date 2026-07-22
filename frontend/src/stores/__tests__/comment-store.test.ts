import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCommentStore } from '../comment-store';

// Mock the API client
vi.mock('../../api/client', () => ({
  fetchComments: vi.fn(),
  createComment: vi.fn(),
  createReply: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  resolveComment: vi.fn(),
}));

const mockComment = {
  id: 'c1',
  document_id: 'doc-1',
  block_id: 'block-1',
  author_id: 'user-1',
  author_display_name: 'Alice',
  author_email: 'alice@test.com',
  content: 'Great work!',
  parent_id: null,
  resolved: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  replies: [],
};

describe('comment-store', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useCommentStore.setState({
      comments: [],
      visible: false,
      activeBlockId: null,
      loading: false,
      error: null,
      currentDocId: null,
    });
  });

  it('toggles visibility', () => {
    expect(useCommentStore.getState().visible).toBe(false);
    useCommentStore.getState().toggleVisibility();
    expect(useCommentStore.getState().visible).toBe(true);
    useCommentStore.getState().toggleVisibility();
    expect(useCommentStore.getState().visible).toBe(false);
  });

  it('sets active block', () => {
    useCommentStore.getState().setActiveBlock('block-2');
    expect(useCommentStore.getState().activeBlockId).toBe('block-2');
    useCommentStore.getState().setActiveBlock(null);
    expect(useCommentStore.getState().activeBlockId).toBeNull();
  });

  it('resets state', () => {
    useCommentStore.setState({
      comments: [mockComment],
      visible: true,
      activeBlockId: 'block-1',
      loading: true,
      currentDocId: 'doc-1',
    });
    useCommentStore.getState().reset();
    const state = useCommentStore.getState();
    expect(state.comments).toEqual([]);
    expect(state.visible).toBe(false);
    expect(state.activeBlockId).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.currentDocId).toBeNull();
  });

  it('fetchComments sets comments and stops loading', async () => {
    const { fetchComments } = await import('../../api/client');
    vi.mocked(fetchComments).mockResolvedValue([mockComment]);

    await useCommentStore.getState().fetchComments('doc-1');
    expect(useCommentStore.getState().comments).toEqual([mockComment]);
    expect(useCommentStore.getState().loading).toBe(false);
    expect(useCommentStore.getState().currentDocId).toBe('doc-1');
  });

  it('fetchComments handles error', async () => {
    const { fetchComments } = await import('../../api/client');
    vi.mocked(fetchComments).mockRejectedValue(new Error('Network error'));

    await useCommentStore.getState().fetchComments('doc-1');
    expect(useCommentStore.getState().error).toBe('Network error');
    expect(useCommentStore.getState().loading).toBe(false);
  });

  it('createComment adds comment to store', async () => {
    const { createComment } = await import('../../api/client');
    vi.mocked(createComment).mockResolvedValue(mockComment);

    const result = await useCommentStore.getState().createComment('doc-1', 'block-1', 'Great work!');
    expect(result).toEqual(mockComment);
    expect(useCommentStore.getState().comments).toContainEqual(mockComment);
  });
});
