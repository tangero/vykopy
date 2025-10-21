import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import type { ProjectComment, CreateCommentRequest } from '../types';
import { commentService } from '../services/commentService';
import { fileService, type FileUploadResponse } from '../services/fileService';
import FileUpload from './FileUpload';
import './ProjectComments.css';

interface ProjectCommentsProps {
  projectId: string;
}

const ProjectComments: React.FC<ProjectCommentsProps> = ({ projectId }) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<FileUploadResponse | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);

  useEffect(() => {
    loadComments();
  }, [projectId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const commentsData = await commentService.getComments(projectId);
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
      setError('Nepodařilo se načíst komentáře');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!user || !newComment.trim()) return;

    // Validate comment
    const validation = commentService.validateComment(newComment);
    if (!validation.isValid) {
      setError(validation.error || 'Neplatný komentář');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Process mentions
      const { mentions } = commentService.processMentions(newComment);

      const commentData: CreateCommentRequest = {
        content: newComment.trim(),
        attachmentUrl: attachedFile?.url
      };

      const newCommentResponse = await commentService.addComment(projectId, commentData);
      
      // Add the new comment to the list
      setComments(prev => [...prev, newCommentResponse]);
      setNewComment('');
      setAttachedFile(null);
      setShowFileUpload(false);

      // Log mentions for notification purposes
      if (mentions.length > 0) {
        console.log('Mentions detected:', mentions);
        // TODO: Trigger notifications for mentioned users
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Nepodařilo se přidat komentář');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAddComment();
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('cs-CZ');
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      regional_admin: 'Regionální administrátor',
      municipal_coordinator: 'Koordinátor obce',
      applicant: 'Žadatel'
    };
    return labels[role as keyof typeof labels] || role;
  };

  const renderCommentContent = (content: string) => {
    // Process @mentions for display
    const { content: processedContent } = commentService.processMentions(content);
    return { __html: processedContent };
  };

  const handleFileUploaded = (file: FileUploadResponse) => {
    setAttachedFile(file);
    setShowFileUpload(false);
    setError(null);
  };

  const handleFileUploadError = (error: string) => {
    setError(error);
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
  };

  const getFileIcon = (mimetype: string) => {
    return fileService.getFileIcon(mimetype);
  };

  if (loading) {
    return (
      <div className="project-comments loading">
        <div className="loading-spinner">Načítání komentářů...</div>
      </div>
    );
  }

  return (
    <div className="project-comments">
      <div className="comments-header">
        <h3>Komentáře ({comments.length})</h3>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="comments-list">
        {comments.length === 0 ? (
          <div className="empty-state">
            <p>Zatím nejsou žádné komentáře.</p>
            {user && <p>Buďte první, kdo přidá komentář!</p>}
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="comment-item">
              <div className="comment-header">
                <div className="comment-author">
                  <strong>{comment.userName}</strong>
                  <span className="comment-role">({getRoleLabel(comment.userRole)})</span>
                </div>
                <div className="comment-date">
                  {formatDateTime(comment.createdAt)}
                </div>
              </div>
              <div 
                className="comment-content"
                dangerouslySetInnerHTML={renderCommentContent(comment.content)}
              />
              {comment.attachmentUrl && (
                <div className="comment-attachment">
                  <a href={comment.attachmentUrl} target="_blank" rel="noopener noreferrer">
                    📎 Příloha
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {user && (
        <div className="add-comment">
          <h4>Přidat komentář</h4>
          <div className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Napište komentář... (Ctrl+Enter pro odeslání, @username pro zmínku)"
              rows={3}
              maxLength={1000}
              disabled={submitting}
            />
            
            {/* File attachment section */}
            {attachedFile && (
              <div className="attached-file">
                <div className="attached-file-info">
                  <span className="file-icon">{getFileIcon(attachedFile.mimetype)}</span>
                  <span className="file-name">{attachedFile.originalName}</span>
                  <span className="file-size">({attachedFile.sizeFormatted})</span>
                </div>
                <button 
                  type="button"
                  onClick={removeAttachedFile}
                  className="remove-file-btn"
                  disabled={submitting}
                >
                  ✕
                </button>
              </div>
            )}

            {showFileUpload && (
              <div className="file-upload-section">
                <FileUpload
                  onFileUploaded={handleFileUploaded}
                  onError={handleFileUploadError}
                  disabled={submitting}
                />
              </div>
            )}

            <div className="comment-actions">
              <div className="comment-meta">
                <span className="char-count">{newComment.length}/1000</span>
                <span className="hint">Ctrl+Enter pro rychlé odeslání</span>
              </div>
              <div className="comment-buttons">
                <button 
                  type="button"
                  onClick={() => setShowFileUpload(!showFileUpload)}
                  className="btn-attach-file"
                  disabled={submitting || !!attachedFile}
                >
                  📎 Příloha
                </button>
                <button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submitting}
                  className="btn-add-comment"
                >
                  {submitting ? 'Přidávání...' : 'Přidat komentář'}
                </button>
              </div>
            </div>
          </div>
          <div className="comment-tips">
            <p><strong>Tipy:</strong></p>
            <ul>
              <li>Použijte @username pro zmínku uživatele</li>
              <li>Maximální délka komentáře je 1000 znaků</li>
              <li>Ctrl+Enter pro rychlé odeslání</li>
            </ul>
          </div>
        </div>
      )}

      {!user && (
        <div className="login-prompt">
          <p>Pro přidání komentáře se musíte přihlásit.</p>
        </div>
      )}
    </div>
  );
};

export default ProjectComments;