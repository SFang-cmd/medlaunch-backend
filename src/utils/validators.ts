import { z } from 'zod';
import { SurveyType, SurveyStatus, AccreditationBody, DeficiencySeverity } from '../models/report';

export const createReportSchema = z.object({
  facilityId: z.string().min(1, 'Facility ID is required'),
  surveyType: z.nativeEnum(SurveyType),
  surveyDate: z.string().datetime('Invalid date format'),
  leadSurveyor: z.string().min(1, 'Lead surveyor is required'),
  surveyScope: z.array(z.string()).min(1, 'Survey scope is required'),
  accreditationBody: z.nativeEnum(AccreditationBody),
  correctiveActionDue: z.string().datetime('Invalid date format').optional(),
  followUpRequired: z.boolean().optional().default(false),
});

export const updateReportSchema = z.object({
  surveyType: z.nativeEnum(SurveyType).optional(),
  leadSurveyor: z.string().min(1).optional(),
  surveyScope: z.array(z.string()).optional(),
  complianceScore: z.number().min(0).max(100).optional(),
  status: z.nativeEnum(SurveyStatus).optional(),
  correctiveActionDue: z.string().datetime('Invalid date format').optional(),
  followUpRequired: z.boolean().optional(),
});

export const reportQuerySchema = z.object({
  view: z.enum(['default', 'summary']).optional().default('default'),
  include: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'complianceScore', 'status']).optional().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  status: z.nativeEnum(SurveyStatus).optional(),
  surveyType: z.nativeEnum(SurveyType).optional(),
});

export const createDeficiencySchema = z.object({
  standardCode: z.string().min(1, 'Standard code is required'),
  description: z.string().min(1, 'Description is required'),
  severity: z.nativeEnum(DeficiencySeverity),
  dueDate: z.string().datetime('Invalid date format').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
export type CreateDeficiencyInput = z.infer<typeof createDeficiencySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;