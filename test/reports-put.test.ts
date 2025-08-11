import request from 'supertest';
import { app, sampleReportIds, getAuthToken } from './setup';

describe('PUT /api/reports/:id - Update Reports', () => {
  describe('User Flow: Authentication + Business Rule Enforcement', () => {
    test('should complete full flow: login as admin -> update immediate jeopardy report', async () => {
      // Step 1: Login as admin to get JWT token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@medlaunch.com',
          password: 'AdminPass123'
        })
        .expect(200);

      const token = loginResponse.body.data.token;
      expect(token).toBeDefined();
      expect(loginResponse.body.data.user.role).toBe('admin');

      // Step 2: Get current report to check version
      const getResponse = await request(app)
        .get(`/api/reports/${sampleReportIds.immediateJeopardy}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const currentVersion = getResponse.body.data.version;
      expect(getResponse.body.data.status).toBe('immediate_jeopardy');

      // Step 3: Update the immediate jeopardy report (only admin can do this)
      const updateData = {
        complianceScore: 70,
        followUpRequired: true,
        version: currentVersion
      };

      const updateResponse = await request(app)
        .put(`/api/reports/${sampleReportIds.immediateJeopardy}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      // Step 4: Verify update succeeded
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.complianceScore).toBe(70);
      expect(updateResponse.body.data.followUpRequired).toBe(true);
      expect(updateResponse.body.data.version).toBe(currentVersion + 1);
      expect(updateResponse.body.message).toBe('Survey report updated successfully');

      // Step 5: Verify ETag header is set for future concurrency control
      expect(updateResponse.headers.etag).toBe(`"${currentVersion + 1}"`);
    });

    test('should enforce business rule: editor cannot edit immediate jeopardy reports', async () => {
      // Step 1: Login as editor
      const editorToken = await getAuthToken('editor');

      // Step 2: Get current version of immediate jeopardy report
      const getResponse = await request(app)
        .get(`/api/reports/${sampleReportIds.immediateJeopardy}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      const currentVersion = getResponse.body.data.version;

      // Step 3: Try to update immediate jeopardy report as editor
      const updateResponse = await request(app)
        .put(`/api/reports/${sampleReportIds.immediateJeopardy}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          complianceScore: 80,
          version: currentVersion
        })
        .expect(403);

      // Step 4: Verify business rule enforcement
      expect(updateResponse.body.success).toBe(false);
      expect(updateResponse.body.error).toContain('Insufficient permissions');
      expect(updateResponse.body.details.userRole).toBe('editor');
      expect(updateResponse.body.details.reportStatus).toBe('immediate_jeopardy');
      expect(updateResponse.body.details.requiredRole).toBe('admin');
    });

    test('should allow editor to edit deficient reports', async () => {
      // Step 1: Login as editor
      const editorToken = await getAuthToken('editor');

      // Step 2: Get current version of deficient report
      const getResponse = await request(app)
        .get(`/api/reports/${sampleReportIds.deficient}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      const currentVersion = getResponse.body.data.version;
      expect(getResponse.body.data.status).toBe('deficient');

      // Step 3: Update deficient report as editor (should succeed)
      const updateResponse = await request(app)
        .put(`/api/reports/${sampleReportIds.deficient}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          complianceScore: 85,
          followUpRequired: false,
          version: currentVersion
        })
        .expect(200);

      // Step 4: Verify update succeeded
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.complianceScore).toBe(85);
      expect(updateResponse.body.data.followUpRequired).toBe(false);
      expect(updateResponse.body.data.version).toBe(currentVersion + 1);
    });

    test('should allow reader to edit compliant reports (for notes)', async () => {
      // Step 1: Login as reader
      const readerToken = await getAuthToken('reader');

      // Step 2: Get current version of compliant report
      const getResponse = await request(app)
        .get(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(200);

      const currentVersion = getResponse.body.data.version;
      expect(getResponse.body.data.status).toBe('compliant');

      // Step 3: Update compliant report as reader (should succeed)
      const updateResponse = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          followUpRequired: true, // Reader can update this field
          version: currentVersion
        })
        .expect(200);

      // Step 4: Verify update succeeded
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.followUpRequired).toBe(true);
      expect(updateResponse.body.data.version).toBe(currentVersion + 1);
    });
  });

  describe('Optimistic Concurrency Control', () => {
    test('should enforce version-based concurrency control', async () => {
      const token = await getAuthToken('admin');

      // Step 1: Get current version
      const getResponse = await request(app)
        .get(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const currentVersion = getResponse.body.data.version;

      // Step 2: Make first update (should succeed)
      await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          complianceScore: 92,
          version: currentVersion
        })
        .expect(200);

      // Step 3: Try second update with same version (should fail)
      const conflictResponse = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          complianceScore: 95,
          version: currentVersion // Old version
        })
        .expect(409);

      // Step 4: Verify conflict error
      expect(conflictResponse.body.success).toBe(false);
      expect(conflictResponse.body.error.code).toBe('CONFLICT');
      expect(conflictResponse.body.error.message).toContain('modified by another user');
      expect(conflictResponse.body.error.details.expectedVersion).toBe(currentVersion);
      expect(conflictResponse.body.error.details.currentVersion).toBe(currentVersion + 1);
    });

    test('should allow concurrent updates with correct version', async () => {
      const token = await getAuthToken('admin');

      // Step 1: Get current version after previous test
      const getResponse = await request(app)
        .get(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const currentVersion = getResponse.body.data.version;

      // Step 2: Make update with correct version (should succeed)
      const updateResponse = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          complianceScore: 96,
          version: currentVersion
        })
        .expect(200);

      expect(updateResponse.body.data.version).toBe(currentVersion + 1);
      expect(updateResponse.body.data.complianceScore).toBe(96);
    });
  });

  describe('Input Validation and Data Processing', () => {
    test('should validate enum values', async () => {
      const token = await getAuthToken('admin');

      const response = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          surveyType: 'invalid_type',
          status: 'invalid_status',
          version: 1
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should validate numeric ranges', async () => {
      const token = await getAuthToken('admin');

      const response = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          complianceScore: 150, // Invalid - over 100
          version: 1
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should validate date formats', async () => {
      const token = await getAuthToken('admin');

      const response = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          correctiveActionDue: 'not-a-date',
          version: 1
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should process date strings correctly', async () => {
      const token = await getAuthToken('admin');

      // Get current version
      const getResponse = await request(app)
        .get(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const currentVersion = getResponse.body.data.version;

      const response = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          correctiveActionDue: '2025-01-31T23:59:59Z',
          version: currentVersion
        })
        .expect(200);

      expect(response.body.data.correctiveActionDue).toBe('2025-01-31T23:59:59.000Z');
      expect(response.body.data.updatedAt).toBeDefined();
    });

    test('should handle partial updates', async () => {
      const token = await getAuthToken('admin');

      // Get current data and version
      const getResponse = await request(app)
        .get(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const currentData = getResponse.body.data;
      const currentVersion = currentData.version;

      // Update only one field
      const response = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          followUpRequired: !currentData.followUpRequired, // Toggle this field only
          version: currentVersion
        })
        .expect(200);

      // Only the updated field should change
      expect(response.body.data.followUpRequired).toBe(!currentData.followUpRequired);
      expect(response.body.data.complianceScore).toBe(currentData.complianceScore);
      expect(response.body.data.leadSurveyor).toBe(currentData.leadSurveyor);
      expect(response.body.data.version).toBe(currentVersion + 1);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent report', async () => {
      const token = await getAuthToken('admin');

      const response = await request(app)
        .put('/api/reports/550e8400-e29b-41d4-a716-999999999999')
        .set('Authorization', `Bearer ${token}`)
        .send({
          complianceScore: 90,
          version: 1
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('should return 400 for invalid UUID', async () => {
      const token = await getAuthToken('admin');

      const response = await request(app)
        .put('/api/reports/invalid-uuid')
        .set('Authorization', `Bearer ${token}`)
        .send({
          complianceScore: 90,
          version: 1
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .send({
          complianceScore: 90,
          version: 1
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should handle empty request body', async () => {
      const token = await getAuthToken('admin');

      const response = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200); // Should succeed with empty update

      expect(response.body.success).toBe(true);
    });
  });

  describe('Audit Trail and Logging', () => {
    test('should update timestamps correctly', async () => {
      const token = await getAuthToken('admin');

      // Get original timestamps
      const getResponse = await request(app)
        .get(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const originalCreatedAt = getResponse.body.data.createdAt;
      const originalUpdatedAt = getResponse.body.data.updatedAt;
      const currentVersion = getResponse.body.data.version;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update report
      const updateResponse = await request(app)
        .put(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          complianceScore: 88,
          version: currentVersion
        })
        .expect(200);

      // Verify timestamps
      expect(updateResponse.body.data.createdAt).toBe(originalCreatedAt); // Should not change
      expect(new Date(updateResponse.body.data.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      ); // Should be updated
    });
  });
});