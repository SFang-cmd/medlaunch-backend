import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';
import { findUserById } from '../services/userRepository';
import { findReportById } from '../services/reportRepository';
import { UserRole } from '../models/user';
import { SurveyStatus } from '../models/report';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new Error();

    const decoded = verifyToken(token) as any;
    const user = findUserById(decoded.id);

    if (!user) throw new Error();

    (req as any).user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', success: false });
  }
}

export function authorize(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden', success: false });
      return;
    }
    next();
  };
}

// Status-based authorization for report editing (custom business rule)
export function authorizeReportEdit() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    const reportId = req.params.id;
    
    if (!user || !reportId) {
      res.status(403).json({ 
        error: 'Forbidden - Missing user or report ID', 
        success: false 
      });
      return;
    }

    // Find the existing report to check its status
    const existingReport = findReportById(reportId);
    if (!existingReport) {
      res.status(404).json({ 
        error: 'Report not found', 
        success: false 
      });
      return;
    }

    // Custom Business Rule: Status-based edit permissions
    const canEdit = checkStatusEditPermission(user.role, existingReport.status);
    
    if (!canEdit) {
      res.status(403).json({ 
        error: `Insufficient permissions to edit ${existingReport.status} reports. Required role: ${getRequiredRoleForStatus(existingReport.status)}`, 
        success: false,
        details: {
          userRole: user.role,
          reportStatus: existingReport.status,
          requiredRole: getRequiredRoleForStatus(existingReport.status)
        }
      });
      return;
    }

    next();
  };
}

// Helper function to check if user role can edit report with given status
function checkStatusEditPermission(userRole: UserRole, reportStatus: SurveyStatus): boolean {
  switch (reportStatus) {
    case SurveyStatus.IMMEDIATE_JEOPARDY:
      // Only admin can edit immediate jeopardy reports
      return userRole === UserRole.ADMIN;
    
    case SurveyStatus.DEFICIENT:
      // Editor and admin can edit deficient reports
      return userRole === UserRole.EDITOR || userRole === UserRole.ADMIN;
    
    case SurveyStatus.COMPLIANT:
      // Reader, editor, and admin can edit compliant reports (for notes)
      return userRole === UserRole.READER || userRole === UserRole.EDITOR || userRole === UserRole.ADMIN;
    
    default:
      return false;
  }
}

// Helper function to get required role for status
function getRequiredRoleForStatus(status: SurveyStatus): string {
  switch (status) {
    case SurveyStatus.IMMEDIATE_JEOPARDY:
      return 'admin';
    case SurveyStatus.DEFICIENT:
      return 'editor or admin';
    case SurveyStatus.COMPLIANT:
      return 'reader, editor, or admin';
    default:
      return 'unknown';
  }
}