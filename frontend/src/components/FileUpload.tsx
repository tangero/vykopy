import React, { useState, useRef } from 'react';
import { fileService, type FileUploadResponse, type FileUploadProgress } from '../services/fileService';
import './FileUpload.css';

interface FileUploadProps {
  onFileUploaded: (file: FileUploadResponse) => void;
  onError?: (error: string) => void;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUploaded,
  onError,
  multiple = false,
  accept,
  maxFiles = 5,
  disabled = false,
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<FileUploadProgress | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Validate number of files
    if (multiple && fileArray.length > maxFiles) {
      onError?.(`Můžete nahrát maximálně ${maxFiles} souborů najednou`);
      return;
    }

    // Validate each file
    for (const file of fileArray) {
      const validation = fileService.validateFile(file);
      if (!validation.isValid) {
        onError?.(validation.error || 'Neplatný soubor');
        return;
      }
    }

    // Upload files
    if (multiple && fileArray.length > 1) {
      uploadMultipleFiles(fileArray);
    } else {
      uploadSingleFile(fileArray[0]);
    }
  };

  const uploadSingleFile = async (file: File) => {
    try {
      setUploading(true);
      setProgress(null);

      const uploadedFile = await fileService.uploadFile(file, (progress) => {
        setProgress(progress);
      });

      onFileUploaded(uploadedFile);
      setProgress(null);
    } catch (error: any) {
      console.error('Upload error:', error);
      onError?.(error.message || 'Nepodařilo se nahrát soubor');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const uploadMultipleFiles = async (files: File[]) => {
    try {
      setUploading(true);
      setProgress(null);

      const uploadedFiles = await fileService.uploadFiles(files, (progress) => {
        setProgress(progress);
      });

      // Call onFileUploaded for each uploaded file
      uploadedFiles.forEach(file => onFileUploaded(file));
      setProgress(null);
    } catch (error: any) {
      console.error('Upload error:', error);
      onError?.(error.message || 'Nepodařilo se nahrát soubory');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (disabled) return;
    
    handleFileSelect(e.dataTransfer.files);
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getAcceptString = () => {
    if (accept) return accept;
    
    // Default accepted file types
    return '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.zip';
  };

  return (
    <div className={`file-upload ${className}`}>
      <div
        className={`file-upload-area ${dragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={getAcceptString()}
          onChange={handleInputChange}
          disabled={disabled}
          style={{ display: 'none' }}
        />

        {uploading ? (
          <div className="upload-progress">
            <div className="upload-icon">📤</div>
            <div className="upload-text">
              <div>Nahrávání...</div>
              {progress && (
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress.percentage}%` }}
                  />
                  <span className="progress-text">{progress.percentage}%</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-icon">📎</div>
            <div className="upload-text">
              <div className="upload-primary">
                {multiple ? 'Přetáhněte soubory nebo klikněte pro výběr' : 'Přetáhněte soubor nebo klikněte pro výběr'}
              </div>
              <div className="upload-secondary">
                Podporované formáty: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT, ZIP
              </div>
              <div className="upload-limit">
                Maximální velikost: 10 MB {multiple && `• Maximálně ${maxFiles} souborů`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;