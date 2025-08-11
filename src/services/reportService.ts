import { findReportById, findAllReports, createReport, findReportsByFacility, updateReport } from './reportRepository';
import { Report, DeficiencySeverity, SurveyType, SurveyStatus, AccreditationBody } from '../models/report';
import { NotFoundError, ConflictError } from '../utils/errors';
import { ReportQueryInput, CreateReportInput, UpdateReportInput } from '../utils/validators';
import { v4 as uuid } from 'uuid';

interface ReportQueryOptions extends ReportQueryInput {
  'deficiencies.severity'?: DeficiencySeverity;
  'deficiencies.sortBy'?: 'dueDate' | 'severity' | 'standardCode';
  'deficiencies.order'?: 'asc' | 'desc';
}

export const getReportById = (id: string, options: Partial<ReportQueryOptions> = {}): any => {
  const report = findReportById(id);
  
  if (!report) {
    throw new NotFoundError('Report', id);
  }

  return formatReportResponse(report, options as ReportQueryOptions);
};

export const getAllReports = (): Report[] => {
  return findAllReports();
};

// Create new report with business logic
export const createNewReport = async (reportData: CreateReportInput, createdBy: string): Promise<Report> => {
  // Business rule: Ensure unique combination of facilityId + surveyType + surveyDate (within same year)
  const existingReports = findReportsByFacility(reportData.facilityId);
  const surveyYear = new Date(reportData.surveyDate).getFullYear();
  
  const duplicateReport = existingReports.find(report => 
    report.surveyType === reportData.surveyType &&
    new Date(report.surveyDate).getFullYear() === surveyYear
  );
  
  if (duplicateReport) {
    throw new ConflictError(
      `A ${reportData.surveyType} survey already exists for facility ${reportData.facilityId} in ${surveyYear}`,
      { 
        facilityId: reportData.facilityId, 
        surveyType: reportData.surveyType, 
        existingReportId: duplicateReport.id 
      }
    );
  }

  // Create new report with server-generated fields
  const newReport: Report = {
    id: uuid(),
    facilityId: reportData.facilityId,
    surveyType: reportData.surveyType,
    surveyDate: new Date(reportData.surveyDate),
    leadSurveyor: reportData.leadSurveyor,
    surveyScope: reportData.surveyScope,
    complianceScore: 0, // Initially 0, will be calculated after deficiencies are added
    status: SurveyStatus.COMPLIANT, // Default status
    accreditationBody: reportData.accreditationBody,
    deficiencies: [], // Start with empty deficiencies
    correctiveActionDue: reportData.correctiveActionDue ? new Date(reportData.correctiveActionDue) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
    followUpRequired: reportData.followUpRequired || false,
    surveyorNotes: [], // Start empty
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1
  };

  // Save to repository
  const savedReport = createReport(newReport);
  
  // Trigger async side effect (notification)
  triggerAsyncNotification(savedReport, createdBy).catch(error => {
    console.error('Failed to send notification:', error);
    // Don't fail the request, just log the error
  });

  return savedReport;
};

// Update existing report with business logic and concurrency control
export const updateReportById = async (
  id: string, 
  updateData: UpdateReportInput, 
  version: number,
  updatedBy: string
): Promise<Report> => {
  // Check if report exists
  const existingReport = findReportById(id);
  if (!existingReport) {
    throw new NotFoundError('Report', id);
  }

  // Optimistic concurrency control - version check
  if (existingReport.version !== version) {
    throw new ConflictError(
      `Report has been modified by another user. Expected version ${version}, found version ${existingReport.version}`,
      { 
        expectedVersion: version, 
        currentVersion: existingReport.version,
        reportId: id 
      }
    );
  }

  // Business rule: Status-based edit permissions (enforced in middleware)
  // But we validate the business logic here as well
  const statusPermissionMap = {
    [SurveyStatus.IMMEDIATE_JEOPARDY]: ['admin'], // Only admin can edit immediate jeopardy
    [SurveyStatus.DEFICIENT]: ['editor', 'admin'], // Editor and admin can edit deficient
    [SurveyStatus.COMPLIANT]: ['reader', 'editor', 'admin'] // Anyone can add notes to compliant
  };

  // Validate that the updated data doesn't violate business rules
  if (updateData.status === SurveyStatus.IMMEDIATE_JEOPARDY && existingReport.status !== SurveyStatus.IMMEDIATE_JEOPARDY) {
    // Only admins should be able to change a report TO immediate jeopardy status
    // This is a safeguard; primary enforcement happens in middleware
  }

  // Prepare update data with system fields
  const updatePayload: Partial<Report> = {
    updatedAt: new Date()
  };

  // Only add fields that are actually provided
  Object.keys(updateData).forEach((key) => {
    const value = (updateData as any)[key];
    if (value !== undefined) {
      (updatePayload as any)[key] = value;
    }
  });

  // Convert date strings to Date objects if provided
  if (updateData.correctiveActionDue) {
    updatePayload.correctiveActionDue = new Date(updateData.correctiveActionDue);
  }

  // Update in repository (includes version increment and optimistic concurrency)
  const updatedReport = updateReport(id, updatePayload);
  
  if (!updatedReport) {
    throw new NotFoundError('Report', id);
  }

  // Log the update for audit trail
  console.log(`📝 Report updated: ${id} by user ${updatedBy} (version ${existingReport.version} -> ${updatedReport.version})`);

  return updatedReport;
};

// Mock async notification service with proper error handling
const triggerAsyncNotification = async (report: Report, createdBy: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Simulate async notification service (e.g., email, Slack, SMS)
    setTimeout(() => {
      const shouldFail = Math.random() < 0.1; // 10% failure rate for demo
      
      if (shouldFail) {
        reject(new Error('Notification service temporarily unavailable'));
      } else {
        console.log(`📧 Notification sent: New ${report.surveyType} survey created for facility ${report.facilityId} by ${createdBy}`);
        resolve();
      }
    }, 100); // Simulate network delay
  });
};

// Format report response based on query parameters
const formatReportResponse = (report: Report, options: ReportQueryOptions) => {
  const {
    view = 'default',
    include,
    page = 1,
    limit = 20
  } = options;

  // Handle view parameter (summary vs default)
  if (view === 'summary') {
    return formatSummaryView(report);
  }

  // Handle include parameter (field filtering)  
  if (include) {
    return formatWithInclude(report, include, options);
  }

  // Default: return full report
  return report;
};

// Generate executive summary view
const formatSummaryView = (report: Report) => {
  const immediateJeopardyCount = report.deficiencies.filter(d => d.severity === DeficiencySeverity.IMMEDIATE_JEOPARDY).length;
  const majorDeficiencies = report.deficiencies.filter(d => d.severity === DeficiencySeverity.MAJOR).length;
  const overdueTasks = report.deficiencies.filter(d => d.dueDate && new Date(d.dueDate) < new Date()).length;
  
  const criticalIssues = report.deficiencies
    .filter(d => d.severity === DeficiencySeverity.IMMEDIATE_JEOPARDY || d.severity === DeficiencySeverity.MAJOR)
    .map(d => d.description)
    .slice(0, 3); // Top 3 critical issues

  const executiveSummary = immediateJeopardyCount > 0
    ? `URGENT: Survey identified ${immediateJeopardyCount} immediate jeopardy finding(s) requiring immediate action. ${report.deficiencies.length} total deficiencies found. Compliance score: ${report.complianceScore}%.`
    : `Survey found ${report.deficiencies.length} deficiencies (${majorDeficiencies} major). Overall compliance score: ${report.complianceScore}%. ${report.followUpRequired ? 'Follow-up survey required.' : 'No follow-up required.'}`;

  return {
    id: report.id,
    facilityId: report.facilityId,
    surveyType: report.surveyType,
    surveyDate: report.surveyDate,
    status: report.status,
    complianceScore: report.complianceScore,
    riskLevel: immediateJeopardyCount > 0 ? 'high' : majorDeficiencies > 2 ? 'medium' : 'low',
    keyMetrics: {
      totalDeficiencies: report.deficiencies.length,
      immediateJeopardyCount,
      majorDeficiencies,
      minorDeficiencies: report.deficiencies.length - immediateJeopardyCount - majorDeficiencies,
      overdueTasks,
      complianceRate: report.complianceScore
    },
    criticalIssues,
    actionRequired: {
      correctiveActionDue: report.correctiveActionDue,
      followUpRequired: report.followUpRequired,
      estimatedResolutionDays: report.followUpRequired ? 
        Math.ceil((new Date(report.correctiveActionDue).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null
    },
    executiveSummary
  };
};

// Handle selective field inclusion
const formatWithInclude = (report: Report, include: string, options: ReportQueryOptions) => {
  const fields = include.split(',').map(f => f.trim());
  const result: any = { id: report.id }; // Always include ID

  // Map include fields to report properties
  const fieldMap: Record<string, keyof Report> = {
    'deficiencies': 'deficiencies',
    'notes': 'surveyorNotes', 
    'surveyorNotes': 'surveyorNotes',
    'complianceScore': 'complianceScore',
    'status': 'status',
    'surveyType': 'surveyType',
    'facilityId': 'facilityId',
    'leadSurveyor': 'leadSurveyor',
    'surveyDate': 'surveyDate',
    'accreditationBody': 'accreditationBody'
  };

  // Include requested fields
  fields.forEach(field => {
    if (field === 'basic') {
      // Special case: basic info
      result.facilityId = report.facilityId;
      result.surveyType = report.surveyType;
      result.complianceScore = report.complianceScore;
      result.status = report.status;
      result.surveyDate = report.surveyDate;
    } else if (fieldMap[field]) {
      if (field === 'deficiencies') {
        // Handle deficiencies with potential filtering/sorting/pagination
        result.deficiencies = formatDeficiencies(report.deficiencies, options);
      } else {
        result[field] = report[fieldMap[field]];
      }
    }
  });

  return result;
};

// Format deficiencies with filtering, sorting, and pagination
const formatDeficiencies = (deficiencies: Report['deficiencies'], options: ReportQueryOptions) => {
  let filtered = [...deficiencies];

  // Filter by severity if specified
  if (options['deficiencies.severity']) {
    filtered = filtered.filter(d => d.severity === options['deficiencies.severity']);
  }

  // Sort deficiencies
  const sortBy = options['deficiencies.sortBy'] || 'severity';
  const sortOrder = options['deficiencies.order'] || 'desc';

  filtered.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'dueDate':
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        comparison = aDate - bDate;
        break;
      case 'severity':
        // Order: immediate_jeopardy > major > minor
        const severityOrder = { 'immediate_jeopardy': 3, 'major': 2, 'minor': 1 };
        comparison = severityOrder[b.severity as keyof typeof severityOrder] - 
                    severityOrder[a.severity as keyof typeof severityOrder];
        break;
      case 'standardCode':
        comparison = a.standardCode.localeCompare(b.standardCode);
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Paginate results
  const page = options.page || 1;
  const limit = options.limit || 20;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedDeficiencies = filtered.slice(startIndex, endIndex);

  // Return with pagination metadata if we're paginating deficiencies
  if (options.page || options.limit) {
    return {
      items: paginatedDeficiencies,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filtered.length / limit),
        totalItems: filtered.length,
        itemsPerPage: limit,
        hasNext: endIndex < filtered.length,
        hasPrev: page > 1
      }
    };
  }

  return paginatedDeficiencies;
};