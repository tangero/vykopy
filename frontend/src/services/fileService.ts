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

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface FileResponse {
  file: FileUploadResponse;
}

interface FilesResponse {
  files: FileUploadResponse[];
}

class FileService {
  /**
   * Upload a single file using XMLHttpRequest for progress tracking
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
        if (onProgress && e.lengthComputable) {
          const progress: FileUploadProgress = {
            loaded: e.loaded,
            total: e.total,
            percentage: Math.round((e.loaded * 100) / e.total)
          };
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response: ApiResponse<FileResponse> = JSON.parse(xhr.responseText);
            if (response.success) {
              resolve(response.data.file);
            } else {
              reject(new Error('Upload failed'));
            }
          } catch (error) {
            reject(new Error('Nepodařilo se nahrát soubor'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error?.message || 'Nepodařilo se nahrát soubor'));
          } catch {
            reject(new Error('Nepodařilo se nahrát soubor'));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Nepodařilo se nahrát soubor'));
      });

      xhr.open('POST', '/api/files/upload');

      const token = localStorage.getItem('token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  }

  /**
   * Upload multiple files using XMLHttpRequest for progress tracking
   */
  async uploadFiles(
    files: File[],
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResponse[]> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
        if (onProgress && e.lengthComputable) {
          const progress: FileUploadProgress = {
            loaded: e.loaded,
            total: e.total,
            percentage: Math.round((e.loaded * 100) / e.total)
          };
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response: ApiResponse<FilesResponse> = JSON.parse(xhr.responseText);
            if (response.success) {
              resolve(response.data.files);
            } else {
              reject(new Error('Upload failed'));
            }
          } catch (error) {
            reject(new Error('Nepodařilo se nahrát soubory'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error?.message || 'Nepodařilo se nahrát soubory'));
          } catch {
            reject(new Error('Nepodařilo se nahrát soubory'));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Nepodařilo se nahrát soubory'));
      });

      xhr.open('POST', '/api/files/upload-multiple');

      const token = localStorage.getItem('token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });
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
