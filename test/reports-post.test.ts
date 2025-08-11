import request from 'supertest';
import { app, authenticatedRequest, validReportData, getAuthToken } from './setup';

describe('POST /api/reports - Create Reports', () => {
  describe('User Flow: Authentication + Report Creation', () => {
    test('should complete full user flow: login as editor -> create report -> verify async notification', async () => {
      // Step 1: Login as editor to get JWT token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'editor@medlaunch.com',
          password: 'EditPass123'
        })
        .expect(200);

      const token = loginResponse.body.data.token;
      expect(token).toBeDefined();
      expect(loginResponse.body.data.user.role).toBe('editor');

      // Step 2: Use JWT token to create report
      const reportData = {
        ...validReportData,
        facilityId: `test-facility-${Date.now()}` // Unique facility ID
      };

      const createResponse = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportData)
        .expect(201);

      // Step 3: Verify report creation
      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data).toHaveProperty('id');
      expect(createResponse.body.data.facilityId).toBe(reportData.facilityId);
      expect(createResponse.body.data.version).toBe(1);
      expect(createResponse.body.data.status).toBe('compliant'); // Default status
      expect(createResponse.body.data.complianceScore).toBe(0); // Default score
      expect(createResponse.body.message).toBe('Survey report created successfully');

      // Step 4: Verify Location header is set
      expect(createResponse.headers.location).toBe(`/api/reports/${createResponse.body.data.id}`);
    });

    test('should enforce business rule: no duplicate surveys per facility/type/year', async () => {
      const token = await getAuthToken('editor');
      const facilityId = `duplicate-test-${Date.now()}`;

      // Step 1: Create first report
      const reportData1 = {
        ...validReportData,
        facilityId,
        surveyType: 'patient_safety',
        surveyDate: '2024-06-15T10:00:00Z'
      };

      await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportData1)
        .expect(201);

      // Step 2: Try to create duplicate (same facility + type + year)
      const reportData2 = {
        ...validReportData,
        facilityId,
        surveyType: 'patient_safety',
        surveyDate: '2024-12-01T10:00:00Z' // Same year (2024)
      };

      const duplicateResponse = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportData2)
        .expect(409);

      // Step 3: Verify conflict error
      expect(duplicateResponse.body.success).toBe(false);
      expect(duplicateResponse.body.error.code).toBe('CONFLICT');
      expect(duplicateResponse.body.error.message).toContain('already exists');
      expect(duplicateResponse.body.error.details).toHaveProperty('facilityId');
      expect(duplicateResponse.body.error.details).toHaveProperty('surveyType');
    });

    test('should allow same facility/type in different years', async () => {
      const token = await getAuthToken('editor');
      const facilityId = `year-test-${Date.now()}`;

      // Create report for 2024
      const report2024 = {
        ...validReportData,
        facilityId,
        surveyType: 'comprehensive',
        surveyDate: '2024-06-15T10:00:00Z'
      };

      await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(report2024)
        .expect(201);

      // Create report for 2025 (different year - should succeed)
      const report2025 = {
        ...validReportData,
        facilityId,
        surveyType: 'comprehensive',
        surveyDate: '2025-06-15T10:00:00Z'
      };

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(report2025)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Authorization Rules', () => {
    test('should allow editor to create reports', async () => {
      const token = await getAuthToken('editor');
      const reportData = {
        ...validReportData,
        facilityId: `editor-test-${Date.now()}`
      };

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should allow admin to create reports', async () => {
      const token = await getAuthToken('admin');
      const reportData = {
        ...validReportData,
        facilityId: `admin-test-${Date.now()}`
      };

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should deny reader from creating reports', async () => {
      const token = await getAuthToken('reader');
      const reportData = {
        ...validReportData,
        facilityId: `reader-test-${Date.now()}`
      };

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('Input Validation', () => {
    test('should validate required fields', async () => {
      const token = await getAuthToken('editor');

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          facilityId: '', // Invalid - empty
          surveyType: 'invalid_type', // Invalid enum value
          surveyDate: 'invalid-date', // Invalid date format
          surveyScope: [] // Invalid - empty array
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });

    test('should validate survey type enum', async () => {
      const token = await getAuthToken('editor');

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validReportData,
          surveyType: 'invalid_survey_type'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should validate accreditation body enum', async () => {
      const token = await getAuthToken('editor');

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validReportData,
          accreditationBody: 'Invalid Organization'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should validate date formats', async () => {
      const token = await getAuthToken('editor');

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validReportData,
          surveyDate: 'not-a-date',
          correctiveActionDue: 'also-not-a-date'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Default Values and Data Processing', () => {
    test('should set correct default values', async () => {
      const token = await getAuthToken('editor');
      
      const minimalData = {
        facilityId: `defaults-test-${Date.now()}`,
        surveyType: 'medication_management',
        surveyDate: '2024-12-01T10:00:00Z',
        leadSurveyor: 'Dr. Defaults Test',
        surveyScope: ['Pharmacy'],
        accreditationBody: 'Joint Commission'
        // Note: followUpRequired not provided, correctiveActionDue not provided
      };

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(minimalData)
        .expect(201);

      expect(response.body.data.complianceScore).toBe(0);
      expect(response.body.data.status).toBe('compliant');
      expect(response.body.data.followUpRequired).toBe(false);
      expect(response.body.data.deficiencies).toEqual([]);
      expect(response.body.data.surveyorNotes).toEqual([]);
      expect(response.body.data.version).toBe(1);
      expect(response.body.data.correctiveActionDue).toBeDefined(); // Should be set to 30 days from now
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();
    });

    test('should generate unique UUIDs', async () => {
      const token = await getAuthToken('editor');
      const createdIds: string[] = [];

      // Create multiple reports
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/reports')
          .set('Authorization', `Bearer ${token}`)
          .send({
            ...validReportData,
            facilityId: `uuid-test-${Date.now()}-${i}`
          })
          .expect(201);

        createdIds.push(response.body.data.id);
      }

      // All IDs should be unique
      const uniqueIds = new Set(createdIds);
      expect(uniqueIds.size).toBe(createdIds.length);

      // All IDs should be valid UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      createdIds.forEach(id => {
        expect(id).toMatch(uuidRegex);
      });
    });
  });

  describe('Error Handling', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/reports')
        .send(validReportData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should handle malformed JSON', async () => {
      const token = await getAuthToken('editor');

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle missing content-type', async () => {
      const token = await getAuthToken('editor');

      await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send('some text data')
        .expect(400);
    });
  });
});