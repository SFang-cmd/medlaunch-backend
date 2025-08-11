import { Express } from 'express';
import request from 'supertest';
import app from '../src/app';

export { app };

// Test user credentials
export const testUsers = {
  reader: {
    email: 'reader@medlaunch.com',
    password: 'ReadPass123'
  },
  editor: {
    email: 'editor@medlaunch.com', 
    password: 'EditPass123'
  },
  admin: {
    email: 'admin@medlaunch.com',
    password: 'AdminPass123'
  }
};

// Helper function to get auth token
export const getAuthToken = async (role: 'reader' | 'editor' | 'admin'): Promise<string> => {
  const credentials = testUsers[role];
  const response = await request(app)
    .post('/api/auth/login')
    .send(credentials)
    .expect(200);

  return response.body.data.token;
};

// Helper function to create authenticated request
export const authenticatedRequest = async (method: string, url: string, role: 'reader' | 'editor' | 'admin' = 'editor') => {
  const token = await getAuthToken(role);
  const req = request(app)[method as keyof typeof request](url)
    .set('Authorization', `Bearer ${token}`);
  return req;
};

// Test data for creating reports
export const validReportData = {
  facilityId: 'test-hospital-automated',
  surveyType: 'infection_control',
  surveyDate: '2024-12-01T10:00:00Z',
  leadSurveyor: 'Dr. Automated Test',
  surveyScope: ['ICU', 'Emergency Department'],
  accreditationBody: 'Joint Commission',
  correctiveActionDue: '2024-12-31T23:59:59Z',
  followUpRequired: false
};

// Known report IDs from sample data
export const sampleReportIds = {
  compliant: '550e8400-e29b-41d4-a716-446655440101', // St. Mary's - compliant
  deficient: '550e8400-e29b-41d4-a716-446655440100', // Mercy General - deficient
  immediateJeopardy: '550e8400-e29b-41d4-a716-446655440103' // Metro General - immediate jeopardy
};

// Clean up function (if needed)
export const cleanup = async () => {
  // Add any cleanup logic here if needed
};