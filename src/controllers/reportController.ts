import { Request, Response } from 'express';
import { getReportById, getAllReports, createNewReport, updateReportById } from '../services/reportService';
import { uuidSchema, reportQuerySchema, createReportSchema, updateReportSchema } from '../utils/validators';
import { createLogger } from '../utils/logger';
import { BadRequestError } from '../utils/errors';

export const getReport = async (req: Request, res: Response): Promise<void> => {
  const logger = createLogger({ 
    requestId: req.headers['x-request-id'] as string,
    userId: (req as any).user?.id,
    action: 'getReport'
  });

  try {
    // Validate report ID
    const reportId = uuidSchema.parse(req.params.id);
    
    // Parse and validate query parameters
    const queryOptions = reportQuerySchema.parse({
      view: req.query.view,
      include: req.query.include,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      status: req.query.status,
      surveyType: req.query.surveyType
    });

    // Add nested query parameters (not in main schema)
    const extendedOptions = {
      ...queryOptions,
      'deficiencies.severity': req.query['deficiencies.severity'] as any,
      'deficiencies.sortBy': req.query['deficiencies.sortBy'] as any,
      'deficiencies.order': req.query['deficiencies.order'] as any
    };
    
    logger.info('Fetching report with options', { reportId, options: extendedOptions });
    
    // Get report from service with formatting options
    const report = getReportById(reportId, extendedOptions);
    
    logger.info('Report retrieved successfully', { reportId, view: queryOptions.view });
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Failed to get report', error as Error, { reportId: req.params.id });
    throw error; // Let error middleware handle it
  }
};

export const getReports = async (req: Request, res: Response): Promise<void> => {
  const logger = createLogger({ 
    requestId: req.headers['x-request-id'] as string,
    userId: (req as any).user?.id,
    action: 'getReports'
  });

  try {
    logger.info('Fetching all reports');
    
    const reports = getAllReports();
    
    logger.info('Reports retrieved successfully', { count: reports.length });
    
    res.json({
      success: true,
      data: reports,
      meta: {
        total: reports.length
      }
    });
  } catch (error) {
    logger.error('Failed to get reports', error as Error);
    throw error;
  }
};

export const createReport = async (req: Request, res: Response): Promise<void> => {
  const logger = createLogger({ 
    requestId: req.headers['x-request-id'] as string,
    userId: (req as any).user?.id,
    action: 'createReport'
  });

  try {
    // Validate request body
    const reportData = createReportSchema.parse(req.body);
    const createdBy = (req as any).user?.id || 'unknown';
    
    logger.info('Creating new report', { 
      facilityId: reportData.facilityId, 
      surveyType: reportData.surveyType,
      createdBy 
    });
    
    // Create report through service
    const newReport = await createNewReport(reportData, createdBy);
    
    logger.info('Report created successfully', { 
      reportId: newReport.id,
      facilityId: newReport.facilityId,
      surveyType: newReport.surveyType
    });
    
    // Return 201 Created with Location header
    res.status(201)
      .location(`/api/reports/${newReport.id}`)
      .json({
        success: true,
        data: newReport,
        message: 'Survey report created successfully'
      });
      
  } catch (error) {
    logger.error('Failed to create report', error as Error, { 
      requestBody: req.body 
    });
    throw error;
  }
};

export const updateReport = async (req: Request, res: Response): Promise<void> => {
  const logger = createLogger({ 
    requestId: req.headers['x-request-id'] as string,
    userId: (req as any).user?.id,
    action: 'updateReport'
  });

  try {
    // Validate report ID
    const reportId = uuidSchema.parse(req.params.id);
    
    // Validate request body
    const updateData = updateReportSchema.parse(req.body);
    
    // Get version from request body or headers (for optimistic concurrency)
    const version = req.body.version || parseInt(req.headers['if-match'] as string) || 1;
    const updatedBy = (req as any).user?.id || 'unknown';
    
    logger.info('Updating report', { 
      reportId, 
      version, 
      updatedBy,
      fieldsToUpdate: Object.keys(updateData)
    });
    
    // Update report through service
    const updatedReport = await updateReportById(reportId, updateData, version, updatedBy);
    
    logger.info('Report updated successfully', { 
      reportId: updatedReport.id,
      newVersion: updatedReport.version,
      status: updatedReport.status
    });
    
    // Return updated report with ETag header for future optimistic concurrency
    res.set('ETag', `"${updatedReport.version}"`)
      .json({
        success: true,
        data: updatedReport,
        message: 'Survey report updated successfully'
      });
      
  } catch (error) {
    logger.error('Failed to update report', error as Error, { 
      reportId: req.params.id,
      requestBody: req.body 
    });
    throw error;
  }
};

export const uploadAttachment = async (req: Request, res: Response): Promise<void> => {
  const logger = createLogger({ 
    requestId: req.headers['x-request-id'] as string,
    userId: (req as any).user?.id,
    action: 'uploadAttachment'
  });

  try {
    // Validate report ID
    const reportId = uuidSchema.parse(req.params.id);
    
    // Check if file was uploaded
    if (!req.file) {
      throw new BadRequestError('No file provided');
    }

    // Verify report exists
    const existingReport = getReportById(reportId);
    if (!existingReport) {
      throw new BadRequestError(`Report ${reportId} not found`);
    }

    const uploadedBy = (req as any).user?.id || 'unknown';
    const file = req.file;
    
    logger.info('Processing file upload', { 
      reportId, 
      uploadedBy,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    });

    // Simulate file processing and secure storage
    const fileRecord = {
      id: require('uuid').v4(),
      reportId,
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedBy,
      uploadedAt: new Date(),
      // In production: generate signed URL for secure access
      downloadUrl: `/api/reports/${reportId}/attachments/${file.filename}`
    };

    logger.info('File uploaded successfully', { 
      fileId: fileRecord.id,
      reportId,
      filename: file.originalname
    });

    res.status(201).json({
      success: true,
      data: {
        fileId: fileRecord.id,
        originalName: fileRecord.originalName,
        size: fileRecord.size,
        mimetype: fileRecord.mimetype,
        downloadUrl: fileRecord.downloadUrl,
        uploadedAt: fileRecord.uploadedAt
      },
      message: 'File uploaded successfully'
    });

  } catch (error) {
    logger.error('Failed to upload file', error as Error, { 
      reportId: req.params.id,
      file: req.file ? {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null
    });
    throw error;
  }
};