export enum SurveyType {
  COMPREHENSIVE = 'comprehensive',
  MEDICATION_MANAGEMENT = 'medication_management',
  INFECTION_CONTROL = 'infection_control',
  PATIENT_SAFETY = 'patient_safety'
}

export enum SurveyStatus {
  COMPLIANT = 'compliant',
  DEFICIENT = 'deficient',
  IMMEDIATE_JEOPARDY = 'immediate_jeopardy'
}

export enum AccreditationBody {
  JOINT_COMMISSION = 'Joint Commission',
  ACHC = 'ACHC',
  DNV = 'DNV'
}

export enum DeficiencySeverity {
  MINOR = 'minor',
  MAJOR = 'major',
  IMMEDIATE_JEOPARDY = 'immediate_jeopardy'
}

export interface Deficiency {
  id: string;
  standardCode: string;
  description: string;
  severity: DeficiencySeverity;
  dueDate?: Date;
}

export interface Report {
  id: string;
  facilityId: string;
  surveyType: SurveyType;
  surveyDate: Date;
  leadSurveyor: string;
  surveyScope: string[];
  complianceScore: number;
  status: SurveyStatus;
  accreditationBody: AccreditationBody;
  deficiencies: Deficiency[];
  correctiveActionDue: Date;
  followUpRequired: boolean;
  surveyorNotes: string[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}


export interface CreateReportRequest {
  facilityId: string;
  surveyType: SurveyType;
  surveyDate: string;
  leadSurveyor: string;
  surveyScope: string[];
  accreditationBody: AccreditationBody;
  correctiveActionDue?: string;
  followUpRequired?: boolean;
}

export interface UpdateReportRequest {
  surveyType?: SurveyType;
  leadSurveyor?: string;
  surveyScope?: string[];
  complianceScore?: number;
  status?: SurveyStatus;
  correctiveActionDue?: string;
  followUpRequired?: boolean;
}

export interface Attachment {
  id: string;
  reportId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  downloadUrl?: string;
  expiresAt?: Date;
}