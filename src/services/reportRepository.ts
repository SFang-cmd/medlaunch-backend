import { v4 as uuid } from 'uuid';
import { Report, SurveyType, SurveyStatus, AccreditationBody, DeficiencySeverity } from '../models/report';

// Sample hospital survey reports with realistic data
const sampleReports: Report[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440100',
    facilityId: 'mercy-general-hospital',
    surveyType: SurveyType.INFECTION_CONTROL,
    surveyDate: new Date('2024-07-15'),
    leadSurveyor: 'Dr. Sarah Johnson',
    surveyScope: ['ICU', 'Emergency Department', 'Surgical Services', 'Medical Floors'],
    complianceScore: 78,
    status: SurveyStatus.DEFICIENT,
    accreditationBody: AccreditationBody.JOINT_COMMISSION,
    deficiencies: [
      {
        id: uuid(),
        standardCode: 'IC.01.01',
        description: 'Hand hygiene compliance rate observed at 72% in ICU, below required 85% threshold',
        severity: DeficiencySeverity.MAJOR,
        dueDate: new Date('2024-09-15')
      },
      {
        id: uuid(),
        standardCode: 'IC.02.01', 
        description: 'Isolation precaution signage missing from 3 patient rooms in Medical Floor East',
        severity: DeficiencySeverity.MINOR,
        dueDate: new Date('2024-08-30')
      },
      {
        id: uuid(),
        standardCode: 'IC.01.03',
        description: 'CRITICAL: Contaminated surgical instruments found in sterile processing area',
        severity: DeficiencySeverity.IMMEDIATE_JEOPARDY,
        dueDate: new Date('2024-07-20')
      }
    ],
    correctiveActionDue: new Date('2024-09-15'),
    followUpRequired: true,
    surveyorNotes: [
      'Overall infection control program is well-structured',
      'Staff training records are comprehensive',
      'Immediate attention needed for surgical instrument processing'
    ],
    createdAt: new Date('2024-07-15'),
    updatedAt: new Date('2024-07-18'),
    version: 2
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440101',
    facilityId: 'st-marys-medical-center',
    surveyType: SurveyType.MEDICATION_MANAGEMENT,
    surveyDate: new Date('2024-06-20'),
    leadSurveyor: 'PharmD Lisa Chen',
    surveyScope: ['Pharmacy', 'ICU', 'Emergency Department', 'Medical/Surgical Units'],
    complianceScore: 92,
    status: SurveyStatus.COMPLIANT,
    accreditationBody: AccreditationBody.JOINT_COMMISSION,
    deficiencies: [
      {
        id: uuid(),
        standardCode: 'MM.01.01',
        description: 'Two high-alert medications found without proper labeling in ED medication room',
        severity: DeficiencySeverity.MINOR,
        dueDate: new Date('2024-08-20')
      }
    ],
    correctiveActionDue: new Date('2024-08-20'),
    followUpRequired: false,
    surveyorNotes: [
      'Excellent medication reconciliation processes',
      'Pharmacy oversight is exemplary', 
      'Minor labeling issue easily correctable'
    ],
    createdAt: new Date('2024-06-20'),
    updatedAt: new Date('2024-06-20'),
    version: 1
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440102',
    facilityId: 'riverside-community-hospital',
    surveyType: SurveyType.COMPREHENSIVE,
    surveyDate: new Date('2024-05-10'),
    leadSurveyor: 'RN Michael Rodriguez',
    surveyScope: ['All Departments', 'Patient Safety', 'Quality Management', 'Leadership'],
    complianceScore: 95,
    status: SurveyStatus.COMPLIANT,
    accreditationBody: AccreditationBody.ACHC,
    deficiencies: [],
    correctiveActionDue: new Date('2024-06-10'),
    followUpRequired: false,
    surveyorNotes: [
      'Outstanding performance across all standards',
      'Leadership commitment to quality is evident',
      'Patient satisfaction scores consistently high'
    ],
    createdAt: new Date('2024-05-10'),
    updatedAt: new Date('2024-05-12'),
    version: 1
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440103',
    facilityId: 'metro-general-hospital',
    surveyType: SurveyType.PATIENT_SAFETY,
    surveyDate: new Date('2024-08-01'),
    leadSurveyor: 'Dr. Amanda Foster',
    surveyScope: ['Surgery', 'Emergency Department', 'Radiology', 'Laboratory'],
    complianceScore: 65,
    status: SurveyStatus.IMMEDIATE_JEOPARDY,
    accreditationBody: AccreditationBody.DNV,
    deficiencies: [
      {
        id: uuid(),
        standardCode: 'PS.01.01',
        description: 'IMMEDIATE JEOPARDY: Patient identification protocol failures resulted in wrong-site surgery incident',
        severity: DeficiencySeverity.IMMEDIATE_JEOPARDY,
        dueDate: new Date('2024-08-05')
      },
      {
        id: uuid(),
        standardCode: 'PS.02.01',
        description: 'Fall prevention protocols not consistently followed in 60% of patient rooms observed',
        severity: DeficiencySeverity.MAJOR,
        dueDate: new Date('2024-09-01')
      },
      {
        id: uuid(),
        standardCode: 'PS.03.01',
        description: 'Medication administration records show timing discrepancies in 15% of cases reviewed',
        severity: DeficiencySeverity.MAJOR,
        dueDate: new Date('2024-08-25')
      },
      {
        id: uuid(),
        standardCode: 'PS.01.02',
        description: 'Patient wristbands found to be illegible or missing in 8 cases during survey',
        severity: DeficiencySeverity.MINOR,
        dueDate: new Date('2024-08-15')
      }
    ],
    correctiveActionDue: new Date('2024-08-05'),
    followUpRequired: true,
    surveyorNotes: [
      'URGENT: Immediate action required to address patient identification failures',
      'Overall patient safety culture needs significant improvement',
      'Recommend comprehensive staff retraining program',
      'Follow-up survey scheduled within 30 days'
    ],
    createdAt: new Date('2024-08-01'),
    updatedAt: new Date('2024-08-03'),
    version: 3
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440104',
    facilityId: 'northside-medical-center',
    surveyType: SurveyType.MEDICATION_MANAGEMENT,
    surveyDate: new Date('2024-04-18'),
    leadSurveyor: 'PharmD Robert Kim',
    surveyScope: ['Central Pharmacy', 'ICU', 'Pediatrics', 'Oncology'],
    complianceScore: 88,
    status: SurveyStatus.DEFICIENT,
    accreditationBody: AccreditationBody.JOINT_COMMISSION,
    deficiencies: [
      {
        id: uuid(),
        standardCode: 'MM.02.01',
        description: 'Chemotherapy medication storage temperatures exceeded acceptable range for 4-hour period',
        severity: DeficiencySeverity.MAJOR,
        dueDate: new Date('2024-06-18')
      },
      {
        id: uuid(),
        standardCode: 'MM.03.01',
        description: 'Pediatric medication dosing calculations found to lack double-verification in 3 instances',
        severity: DeficiencySeverity.MAJOR,
        dueDate: new Date('2024-06-01')
      },
      {
        id: uuid(),
        standardCode: 'MM.01.02',
        description: 'High-alert medication storage area lacks adequate security measures',
        severity: DeficiencySeverity.MINOR,
        dueDate: new Date('2024-05-30')
      }
    ],
    correctiveActionDue: new Date('2024-06-18'),
    followUpRequired: true,
    surveyorNotes: [
      'Pharmacy staff demonstrate strong clinical knowledge',
      'Temperature monitoring systems need upgrade',
      'Pediatric protocols require immediate attention'
    ],
    createdAt: new Date('2024-04-18'),
    updatedAt: new Date('2024-04-20'),
    version: 1
  }
];

// Repository functions
export const findReportById = (id: string): Report | undefined => {
  return sampleReports.find(report => report.id === id);
};

export const findAllReports = (): Report[] => {
  return sampleReports;
};

export const findReportsByFacility = (facilityId: string): Report[] => {
  return sampleReports.filter(report => report.facilityId === facilityId);
};

export const findReportsBySurveyType = (surveyType: SurveyType): Report[] => {
  return sampleReports.filter(report => report.surveyType === surveyType);
};

export const findReportsByStatus = (status: SurveyStatus): Report[] => {
  return sampleReports.filter(report => report.status === status);
};

export const createReport = (report: Report): Report => {
  sampleReports.push(report);
  return report;
};

export const updateReport = (id: string, updateData: Partial<Report>): Report | null => {
  const index = sampleReports.findIndex(report => report.id === id);
  if (index === -1) return null;
  
  const existingReport = sampleReports[index];
  if (!existingReport) return null;
  
  sampleReports[index] = { 
    ...existingReport, 
    ...updateData, 
    updatedAt: new Date(), 
    version: existingReport.version + 1 
  };
  
  return sampleReports[index] || null;
};

export const deleteReport = (id: string): boolean => {
  const index = sampleReports.findIndex(report => report.id === id);
  if (index === -1) return false;
  
  sampleReports.splice(index, 1);
  return true;
};

export { sampleReports };