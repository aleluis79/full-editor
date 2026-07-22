import { create } from 'zustand';
import type { CommentData, CommentUpdateData } from '../api/client';
import {
  fetchComments as apiFetchComments,
  createComment as apiCreateComment,
  createReply as apiCreateReply,
  updateComment as apiUpdateComment,
  deleteComment as apiDeleteComment,
  resolveComment as apiResolveComment,
} from '../api/client';

interface CommentState {
  comments: CommentData[];
  visible: boolean;
  activeBlockId: string | null;
  loading: boolean;
  error: string | null;
  currentDocId: string | null;

  fetchComments: (docId: string) => Promise<void>;
  createComment: (docId: string, blockId: string, content: string) => Promise<CommentData>;
  createReply: (docId: string, parentId: string, blockId: string, content: string) => Promise<CommentData>;
  updateComment: (docId: string, commentId: string, data: CommentUpdateData) => Promise<void>;
  deleteComment: (docId: string, commentId: string) => Promise<void>;
  toggleResolved: (docId: string, commentId: string) => Promise<void>;
  toggleVisibility: () => void;
  setActiveBlock: (blockId: string | null) => void;
  reset: () => void;
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: [],
  visible: false,
  activeBlockId: null,
  loading: false,
  error: null,
  currentDocId: null,

  fetchComments: async (docId: string) => {
    set({ loading: true, error: null, currentDocId: docId });
    try {
      const comments = await apiFetchComments(docId);
      set({ comments, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createComment: async (docId: string, blockId: string, content: string) => {
    try {
      const comment = await apiCreateComment(docId, { block_id: blockId, content });
      set((state) => ({ comments: [...state.comments, comment] }));
      return comment;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  createReply: async (docId: string, parentId: string, blockId: string, content: string) => {
    try {
      const reply = await apiCreateReply(docId, parentId, { block_id: blockId, content });
      // Re-fetch to get nested structure
      await get().fetchComments(docId);
      return reply;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  updateComment: async (docId: string, commentId: string, data: CommentUpdateData) => {
    try {
      await apiUpdateComment(docId, commentId, data);
      await get().fetchComments(docId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  deleteComment: async (docId: string, commentId: string) => {
    try {
      await apiDeleteComment(docId, commentId);
      await get().fetchComments(docId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  toggleResolved: async (docId: string, commentId: string) => {
    try {
      await apiResolveComment(docId, commentId);
      await get().fetchComments(docId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  toggleVisibility: () => {
    set((state) => ({ visible: !state.visible }));
  },

  setActiveBlock: (blockId: string | null) => {
    set({ activeBlockId: blockId });
  },

  reset: () => {
    set({
      comments: [],
      visible: false,
      activeBlockId: null,
      loading: false,
      error: null,
      currentDocId: null,
    });
  },
}));
