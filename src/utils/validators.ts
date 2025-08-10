import { z } from 'zod';
import { ReportStatus, Priority, EntryType, EntryStatus } from '../models/report';

export const createReportSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description too long'),
  businessKey: z.string().min(1, 'Business key is required').max(100, 'Business key too long'),
  priority: z.nativeEnum(Priority).optional().default(Priority.MEDIUM),
  assignedTo: z.string().uuid('Invalid user ID').optional(),
  dueDate: z.string().datetime('Invalid date format').optional(),
  tags: z.array(z.string().max(50, 'Tag too long')).max(20, 'Too many tags').optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const updateReportSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().min(1, 'Description is required').max(2000, 'Description too long').optional(),
  status: z.nativeEnum(ReportStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assignedTo: z.string().uuid('Invalid user ID').optional(),
  dueDate: z.string().datetime('Invalid date format').optional(),
  tags: z.array(z.string().max(50, 'Tag too long')).max(20, 'Too many tags').optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const reportQuerySchema = z.object({
  view: z.enum(['default', 'summary']).optional().default('default'),
  include: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status']).optional().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  status: z.nativeEnum(ReportStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
});

export const createEntrySchema = z.object({
  content: z.string().min(1, 'Content is required').max(1000, 'Content too long'),
  type: z.nativeEnum(EntryType).default(EntryType.NOTE),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
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
export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;