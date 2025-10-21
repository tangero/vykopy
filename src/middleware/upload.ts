import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

// Ensure upload directory exists
const uploadDir = config.upload.path;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter for allowed file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types for project attachments
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

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Nepodporovaný typ souboru: ${file.mimetype}. Povolené typy: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT, ZIP`));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize, // 10MB by default
    files: 5 // Maximum 5 files per request
  }
});

// Middleware for single file upload
export const uploadSingle = upload.single('file');

// Middleware for multiple file upload
export const uploadMultiple = upload.array('files', 5);

// Helper function to get file URL
export const getFileUrl = (filename: string): string => {
  return `/api/files/${filename}`;
};

// Helper function to validate file size
export const validateFileSize = (size: number): boolean => {
  return size <= config.upload.maxSize;
};

// Helper function to get file extension
export const getFileExtension = (filename: string): string => {
  return path.extname(filename).toLowerCase();
};

// Helper function to check if file is image
export const isImageFile = (mimetype: string): boolean => {
  return mimetype.startsWith('image/');
};

// Helper function to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Error handler for multer errors
export const handleUploadError = (error: any) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return {
          code: 'FILE_TOO_LARGE',
          message: `Soubor je příliš velký. Maximální velikost je ${formatFileSize(config.upload.maxSize)}.`
        };
      case 'LIMIT_FILE_COUNT':
        return {
          code: 'TOO_MANY_FILES',
          message: 'Příliš mnoho souborů. Maximálně 5 souborů najednou.'
        };
      case 'LIMIT_UNEXPECTED_FILE':
        return {
          code: 'UNEXPECTED_FILE',
          message: 'Neočekávaný soubor v požadavku.'
        };
      default:
        return {
          code: 'UPLOAD_ERROR',
          message: 'Chyba při nahrávání souboru.'
        };
    }
  }
  
  return {
    code: 'UPLOAD_ERROR',
    message: error.message || 'Chyba při nahrávání souboru.'
  };
};