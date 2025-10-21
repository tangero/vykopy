import { api } from '../utils/api';
import type { ProjectComment, CreateCommentRequest } from '../types';

class CommentService {
  /**
   * Get all comments for a project
   */
  async getComments(projectId: string): Promise<ProjectComment[]> {
    try {
      const response = await api.get(`/projects/${projectId}/comments`);
      
      if (response.data.success) {
        return response.data.data.comments.map((comment: any) => ({
          id: comment.id,
          projectId: comment.projectId,
          userId: comment.userId,
          userName: comment.userName,
          userRole: comment.userRole,
          content: comment.content,
          attachmentUrl: comment.attachmentUrl,
          createdAt: comment.createdAt
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }
  }

  /**
   * Add a new comment to a project
   */
  async addComment(projectId: string, data: CreateCommentRequest): Promise<ProjectComment> {
    try {
      const response = await api.post(`/projects/${projectId}/comments`, {
        content: data.content,
        attachmentUrl: data.attachmentUrl
      });

      if (response.data.success) {
        const comment = response.data.data.comment;
        return {
          id: comment.id,
          projectId: comment.projectId,
          userId: comment.userId,
          userName: comment.userName,
          userRole: comment.userRole,
          content: comment.content,
          attachmentUrl: comment.attachmentUrl,
          createdAt: comment.createdAt
        };
      }

      throw new Error('Failed to add comment');
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  /**
   * Process @mentions in comment content
   */
  processMentions(content: string): { content: string; mentions: string[] } {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    // Convert @mentions to clickable links (for display purposes)
    const processedContent = content.replace(mentionRegex, '<span class="mention">@$1</span>');

    return {
      content: processedContent,
      mentions: [...new Set(mentions)] // Remove duplicates
    };
  }

  /**
   * Validate comment content
   */
  validateComment(content: string): { isValid: boolean; error?: string } {
    if (!content.trim()) {
      return { isValid: false, error: 'Komentář nemůže být prázdný' };
    }

    if (content.length > 1000) {
      return { isValid: false, error: 'Komentář může mít maximálně 1000 znaků' };
    }

    return { isValid: true };
  }
}

export const commentService = new CommentService();