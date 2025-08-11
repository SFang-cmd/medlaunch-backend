import request from 'supertest';
import { app, getAuthToken, validReportData } from './setup';

describe('Integration Tests - End-to-End User Flows', () => {
  describe('Complete Report Management Workflow', () => {
    test('should complete full CRUD workflow: create -> read -> update -> upload attachment', async () => {
      // Step 1: Login as editor
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'editor@medlaunch.com',
          password: 'EditPass123'
        })
        .expect(200);

      const token = loginResponse.body.data.token;
      const userId = loginResponse.body.data.user.id;
      expect(loginResponse.body.data.user.role).toBe('editor');

      // Step 2: Create new report
      const facilityId = `integration-test-${Date.now()}`;
      const createData = {
        ...validReportData,
        facilityId
      };

      const createResponse = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(createData)
        .expect(201);

      const reportId = createResponse.body.data.id;
      const initialVersion = createResponse.body.data.version;
      expect(createResponse.body.data.status).toBe('compliant');
      expect(createResponse.body.data.complianceScore).toBe(0);

      // Step 3: Read the created report with different views
      // 3a. Default view
      const getDefaultResponse = await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getDefaultResponse.body.data.facilityId).toBe(facilityId);
      expect(getDefaultResponse.body.data.deficiencies).toEqual([]);

      // 3b. Summary view
      const getSummaryResponse = await request(app)
        .get(`/api/reports/${reportId}?view=summary`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getSummaryResponse.body.data).toHaveProperty('executiveSummary');
      expect(getSummaryResponse.body.data.riskLevel).toBe('low');
      expect(getSummaryResponse.body.data.keyMetrics.totalDeficiencies).toBe(0);

      // 3c. Selective fields
      const getSelectiveResponse = await request(app)
        .get(`/api/reports/${reportId}?include=complianceScore,status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getSelectiveResponse.body.data.complianceScore).toBe(0);
      expect(getSelectiveResponse.body.data.status).toBe('compliant');
      expect(getSelectiveResponse.body.data).not.toHaveProperty('deficiencies');

      // Step 4: Update the report
      const updateData = {
        complianceScore: 88,
        followUpRequired: true,
        version: initialVersion
      };

      const updateResponse = await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.data.complianceScore).toBe(88);
      expect(updateResponse.body.data.followUpRequired).toBe(true);
      expect(updateResponse.body.data.version).toBe(initialVersion + 1);

      // Step 5: Upload attachment
      const testFileContent = 'Integration test document content for report workflow validation';
      
      const uploadResponse = await request(app)
        .post(`/api/reports/${reportId}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .field('description', 'Integration test attachment')
        .attach('attachment', Buffer.from(testFileContent), 'integration-test.txt')
        .expect(201);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.originalName).toBe('integration-test.txt');
      expect(uploadResponse.body.data.size).toBe(testFileContent.length);

      // Step 6: Verify final state with all changes
      const finalGetResponse = await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(finalGetResponse.body.data.complianceScore).toBe(88);
      expect(finalGetResponse.body.data.followUpRequired).toBe(true);
      expect(finalGetResponse.body.data.version).toBe(initialVersion + 1);
      expect(new Date(finalGetResponse.body.data.updatedAt).getTime()).toBeGreaterThan(
        new Date(finalGetResponse.body.data.createdAt).getTime()
      );
    });

    test('should demonstrate role-based access control across all endpoints', async () => {
      const facilityId = `rbac-test-${Date.now()}`;

      // Step 1: Admin creates a report and escalates it to immediate jeopardy
      const adminToken = await getAuthToken('admin');
      
      const createResponse = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validReportData,
          facilityId
        })
        .expect(201);

      const reportId = createResponse.body.data.id;
      const initialVersion = createResponse.body.data.version;

      // Admin escalates to immediate jeopardy
      const escalateResponse = await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'immediate_jeopardy',
          complianceScore: 45,
          version: initialVersion
        })
        .expect(200);

      expect(escalateResponse.body.data.status).toBe('immediate_jeopardy');
      const ijVersion = escalateResponse.body.data.version;

      // Step 2: Reader can view but cannot modify
      const readerToken = await getAuthToken('reader');

      // Reader can read
      await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(200);

      // Reader cannot update immediate jeopardy report
      await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          complianceScore: 50,
          version: ijVersion
        })
        .expect(403);

      // Reader cannot upload files
      await request(app)
        .post(`/api/reports/${reportId}/attachment`)
        .set('Authorization', `Bearer ${readerToken}`)
        .attach('attachment', Buffer.from('test'), 'test.txt')
        .expect(403);

      // Step 3: Editor can view but cannot modify immediate jeopardy
      const editorToken = await getAuthToken('editor');

      // Editor can read
      await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      // Editor cannot update immediate jeopardy report
      const editorUpdateResponse = await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          complianceScore: 55,
          version: ijVersion
        })
        .expect(403);

      expect(editorUpdateResponse.body.details.userRole).toBe('editor');
      expect(editorUpdateResponse.body.details.reportStatus).toBe('immediate_jeopardy');
      expect(editorUpdateResponse.body.details.requiredRole).toBe('admin');

      // Editor can upload files (but not modify report content)
      await request(app)
        .post(`/api/reports/${reportId}/attachment`)
        .set('Authorization', `Bearer ${editorToken}`)
        .attach('attachment', Buffer.from('editor upload test'), 'editor-file.txt')
        .expect(201);

      // Step 4: Only admin can modify immediate jeopardy report
      const adminUpdateResponse = await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complianceScore: 60,
          followUpRequired: true,
          version: ijVersion
        })
        .expect(200);

      expect(adminUpdateResponse.body.data.complianceScore).toBe(60);
      expect(adminUpdateResponse.body.data.followUpRequired).toBe(true);
    });

    test('should handle concurrent updates and optimistic locking', async () => {
      // Setup: Create a report
      const adminToken = await getAuthToken('admin');
      const editorToken = await getAuthToken('editor');
      
      const createResponse = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validReportData,
          facilityId: `concurrency-test-${Date.now()}`
        })
        .expect(201);

      const reportId = createResponse.body.data.id;
      const initialVersion = createResponse.body.data.version;

      // Step 1: Two users get the same report version
      const admin1GetResponse = await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const admin2GetResponse = await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(admin1GetResponse.body.data.version).toBe(initialVersion);
      expect(admin2GetResponse.body.data.version).toBe(initialVersion);

      // Step 2: First admin updates successfully
      const firstUpdateResponse = await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complianceScore: 75,
          version: initialVersion
        })
        .expect(200);

      expect(firstUpdateResponse.body.data.version).toBe(initialVersion + 1);

      // Step 3: Second admin tries to update with stale version (should fail)
      const conflictResponse = await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complianceScore: 80,
          version: initialVersion // Stale version
        })
        .expect(409);

      expect(conflictResponse.body.error.code).toBe('CONFLICT');
      expect(conflictResponse.body.error.details.expectedVersion).toBe(initialVersion);
      expect(conflictResponse.body.error.details.currentVersion).toBe(initialVersion + 1);

      // Step 4: Second admin gets fresh version and updates successfully
      const freshGetResponse = await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const currentVersion = freshGetResponse.body.data.version;

      const secondUpdateResponse = await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complianceScore: 82,
          version: currentVersion
        })
        .expect(200);

      expect(secondUpdateResponse.body.data.complianceScore).toBe(82);
      expect(secondUpdateResponse.body.data.version).toBe(currentVersion + 1);
    });

    test('should validate business rules across multiple operations', async () => {
      const facilityId = `business-rules-test-${Date.now()}`;
      const editorToken = await getAuthToken('editor');

      // Step 1: Create first survey
      const firstSurvey = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          ...validReportData,
          facilityId,
          surveyType: 'comprehensive',
          surveyDate: '2024-06-15T10:00:00Z'
        })
        .expect(201);

      // Step 2: Try to create duplicate survey (should fail)
      await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          ...validReportData,
          facilityId,
          surveyType: 'comprehensive',
          surveyDate: '2024-11-20T14:00:00Z' // Same year
        })
        .expect(409);

      // Step 3: Create different survey type (should succeed)
      await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          ...validReportData,
          facilityId,
          surveyType: 'infection_control', // Different type
          surveyDate: '2024-08-10T09:00:00Z'
        })
        .expect(201);

      // Step 4: Create same type in different year (should succeed)
      await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          ...validReportData,
          facilityId,
          surveyType: 'comprehensive', // Same type
          surveyDate: '2025-03-15T11:00:00Z' // Different year
        })
        .expect(201);

      // Step 5: Update first survey's status and test permission changes
      const adminToken = await getAuthToken('admin');
      
      const updateToDeficient = await request(app)
        .put(`/api/reports/${firstSurvey.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'deficient',
          complianceScore: 72,
          version: 1
        })
        .expect(200);

      // Step 6: Editor should now be able to edit deficient report
      await request(app)
        .put(`/api/reports/${firstSurvey.body.data.id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          followUpRequired: true,
          version: updateToDeficient.body.data.version
        })
        .expect(200);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network-like errors gracefully', async () => {
      const token = await getAuthToken('editor');

      // Test malformed requests
      const tests = [
        {
          name: 'Invalid JSON',
          request: () => request(app)
            .post('/api/reports')
            .set('Authorization', `Bearer ${token}`)
            .set('Content-Type', 'application/json')
            .send('{ invalid json }'),
          expectedStatus: 400
        },
        {
          name: 'Missing required fields',
          request: () => request(app)
            .post('/api/reports')
            .set('Authorization', `Bearer ${token}`)
            .send({}),
          expectedStatus: 400
        },
        {
          name: 'Invalid UUID format',
          request: () => request(app)
            .get('/api/reports/not-a-uuid')
            .set('Authorization', `Bearer ${token}`),
          expectedStatus: 400
        },
        {
          name: 'Non-existent resource',
          request: () => request(app)
            .get('/api/reports/550e8400-e29b-41d4-a716-999999999999')
            .set('Authorization', `Bearer ${token}`),
          expectedStatus: 404
        }
      ];

      for (const test of tests) {
        const response = await test.request().expect(test.expectedStatus);
        
        // All error responses should have consistent format
        expect(response.body.success).toBe(false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      }
    });

    test('should maintain data consistency during errors', async () => {
      const token = await getAuthToken('editor');
      const facilityId = `consistency-test-${Date.now()}`;

      // Create a report
      const createResponse = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validReportData,
          facilityId
        })
        .expect(201);

      const reportId = createResponse.body.data.id;
      const initialVersion = createResponse.body.data.version;

      // Try invalid update (should fail but not corrupt data)
      await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          complianceScore: 150, // Invalid - over 100
          version: initialVersion
        })
        .expect(400);

      // Verify original data is unchanged
      const getAfterError = await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getAfterError.body.data.version).toBe(initialVersion);
      expect(getAfterError.body.data.complianceScore).toBe(0); // Original value
    });
  });
});