import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth';
import { uploadSingle, uploadMultiple, handleUploadError, getFileUrl, formatFileSize } from '../middleware/upload';
import { config } from '../config';

const router = express.Router();

// POST /api/files/upload - Upload single file
router.post('/upload', authenticateToken, (req: Request, res: Response): void => {
  uploadSingle(req, res, (err) => {
    if (err) {
      const errorInfo = handleUploadError(err);
      res.status(400).json({
        error: {
          code: errorInfo.code,
          message: errorInfo.message,
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'Nebyl vybrán žádný soubor',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    const fileInfo = {
      id: req.file.filename,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      sizeFormatted: formatFileSize(req.file.size),
      url: getFileUrl(req.file.filename),
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      data: { file: fileInfo }
    });
  });
});

// POST /api/files/upload-multiple - Upload multiple files
router.post('/upload-multiple', authenticateToken, (req: Request, res: Response): void => {
  uploadMultiple(req, res, (err) => {
    if (err) {
      const errorInfo = handleUploadError(err);
      res.status(400).json({
        error: {
          code: errorInfo.code,
          message: errorInfo.message,
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        error: {
          code: 'NO_FILES',
          message: 'Nebyly vybrány žádné soubory',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    const filesInfo = req.files.map(file => ({
      id: file.filename,
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      url: getFileUrl(file.filename),
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    }));

    res.status(201).json({
      success: true,
      data: { files: filesInfo }
    });
  });
});

// GET /api/files/:filename - Download/serve file
router.get('/:filename', (req: Request, res: Response): void => {
  const { filename } = req.params;

  // Validate filename to prevent directory traversal
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    res.status(400).json({
      error: {
        code: 'INVALID_FILENAME',
        message: 'Neplatný název souboru',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
    return;
  }

  const filePath = path.join(config.upload.path, filename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.status(404).json({
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'Soubor nebyl nalezen',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
    return;
  }

  // Get file stats
  const stats = fs.statSync(filePath);
  
  // Set appropriate headers
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  // Determine content type based on file extension
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.zip': 'application/zip'
  };

  const contentType = contentTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);

  fileStream.on('error', (error) => {
    console.error('File stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: 'FILE_READ_ERROR',
          message: 'Chyba při čtení souboru',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    }
  });
});

// DELETE /api/files/:filename - Delete file (admin only)
router.delete('/:filename', authenticateToken, (req: Request, res: Response): void => {
  const { filename } = req.params;

  // Only allow admins to delete files
  if (req.user?.role !== 'regional_admin') {
    res.status(403).json({
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Nedostatečná oprávnění pro smazání souboru',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
    return;
  }

  // Validate filename
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    res.status(400).json({
      error: {
        code: 'INVALID_FILENAME',
        message: 'Neplatný název souboru',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
    return;
  }

  const filePath = path.join(config.upload.path, filename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.status(404).json({
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'Soubor nebyl nalezen',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
    return;
  }

  try {
    fs.unlinkSync(filePath);
    res.json({
      success: true,
      message: 'Soubor byl úspěšně smazán'
    });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      error: {
        code: 'FILE_DELETE_ERROR',
        message: 'Chyba při mazání souboru',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// GET /api/files - List uploaded files (admin only)
router.get('/', authenticateToken, (req: Request, res: Response): void => {
  // Only allow admins to list files
  if (req.user?.role !== 'regional_admin') {
    res.status(403).json({
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Nedostatečná oprávnění pro zobrazení seznamu souborů',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
    return;
  }

  try {
    const files = fs.readdirSync(config.upload.path);
    const fileList = files.map(filename => {
      const filePath = path.join(config.upload.path, filename);
      const stats = fs.statSync(filePath);
      
      return {
        filename,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        url: getFileUrl(filename),
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString()
      };
    });

    res.json({
      success: true,
      data: { files: fileList }
    });
  } catch (error) {
    console.error('File listing error:', error);
    res.status(500).json({
      error: {
        code: 'FILE_LIST_ERROR',
        message: 'Chyba při načítání seznamu souborů',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

export default router;