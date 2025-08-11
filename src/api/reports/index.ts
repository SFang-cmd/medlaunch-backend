import { Router } from 'express';
import { getReport, getReports, createReport, updateReport, uploadAttachment } from '../../controllers/reportController';
import { authenticate, authorize, authorizeReportEdit } from '../../middleware/auth';
import { uploadSingle, handleUploadError } from '../../middleware/upload';
import { UserRole } from '../../models/user';

const router = Router();

// GET /api/reports - Get all reports (any authenticated user)
router.get('/', authenticate, getReports);

// GET /api/reports/:id - Get specific report (any authenticated user)
router.get('/:id', authenticate, getReport);

// POST /api/reports - Create new report (editor/admin only)
router.post('/', authenticate, authorize([UserRole.EDITOR, UserRole.ADMIN]), createReport);

// PUT /api/reports/:id - Update existing report (with custom status-based permissions)
router.put('/:id', authenticate, authorizeReportEdit(), updateReport);

// POST /api/reports/:id/attachment - Upload file attachment (editor/admin only)
router.post('/:id/attachment', 
  authenticate, 
  authorize([UserRole.EDITOR, UserRole.ADMIN]), 
  uploadSingle,
  handleUploadError,
  uploadAttachment
);

export default router;