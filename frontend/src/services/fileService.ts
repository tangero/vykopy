import { api } from '../utils/api';

export interface FileUploadResponse {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  sizeFormatted: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

class FileService {
  /**
   * Upload a single file
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress: FileUploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total)
            };
            onProgress(progress);
          }
        }
      });

      if (response.data.success) {
        return response.data.data.file;
      }

      throw new Error('Upload failed');
    } catch (error: any) {
      console.error('File upload error:', error);
      
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error.message);
      }
      
      throw new Error('Nepodařilo se nahrát soubor');
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: File[],
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResponse[]> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await api.post('/files/upload-multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress: FileUploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total)
            };
            onProgress(progress);
          }
        }
      });

      if (response.data.success) {
        return response.data.data.files;
      }

      throw new Error('Upload failed');
    } catch (error: any) {
      console.error('Files upload error:', error);
      
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error.message);
      }
      
      throw new Error('Nepodařilo se nahrát soubory');
    }
  }

  /**
   * Get file download URL
   */
  getFileUrl(filename: string): string {
    return `/api/files/${filename}`;
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `Soubor je příliš velký. Maximální velikost je ${this.formatFileSize(maxSize)}.`
      };
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed'
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Nepodporovaný typ souboru. Povolené typy: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT, ZIP'
      };
    }

    return { isValid: true };
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Check if file is an image
   */
  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Get file icon based on file type
   */
  getFileIcon(mimetype: string): string {
    if (mimetype.startsWith('image/')) return '🖼️';
    if (mimetype === 'application/pdf') return '📄';
    if (mimetype.includes('word')) return '📝';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return '📊';
    if (mimetype.includes('zip')) return '📦';
    if (mimetype === 'text/plain') return '📃';
    return '📎';
  }

  /**
   * Create a preview URL for images
   */
  createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isImageFile(file)) {
        reject(new Error('File is not an image'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }
}

export const fileService = new FileService();