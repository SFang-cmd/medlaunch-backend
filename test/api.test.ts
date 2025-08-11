import request from 'supertest';
import { app } from '../src/app';

describe('API Comprehensive Tests', () => {
  let editorToken: string;
  let adminToken: string;
  let readerToken: string;

  // Get auth tokens before running tests
  beforeAll(async () => {
    // Get editor token
    const editorResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'editor@medlaunch.com',
        password: 'EditPass123'
      })
      .expect(200);
    editorToken = editorResponse.body.data.token;

    // Get admin token
    const adminResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@medlaunch.com',
        password: 'AdminPass123'
      })
      .expect(200);
    adminToken = adminResponse.body.data.token;

    // Get reader token
    const readerResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'reader@medlaunch.com',
        password: 'ReadPass123'
      })
      .expect(200);
    readerToken = readerResponse.body.data.token;
  });

  describe('Authentication Tests', () => {
    test('should authenticate all user roles', () => {
      expect(editorToken).toBeDefined();
      expect(adminToken).toBeDefined();
      expect(readerToken).toBeDefined();
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@medlaunch.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/reports', () => {
    test('should list all reports for authenticated user', async () => {
      const response = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/reports')
        .expect(401);
    });
  });

  describe('GET /api/reports/:id', () => {
    const sampleReportId = '550e8400-e29b-41d4-a716-446655440103';

    test('should return report with default view', async () => {
      const response = await request(app)
        .get(`/api/reports/${sampleReportId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(sampleReportId);
      expect(response.body.data).toHaveProperty('deficiencies');
    });

    test('should return executive summary view', async () => {
      const response = await request(app)
        .get(`/api/reports/${sampleReportId}?view=summary`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('executiveSummary');
      expect(response.body.data).toHaveProperty('riskLevel');
      expect(response.body.data).toHaveProperty('keyMetrics');
    });

    test('should filter deficiencies by severity', async () => {
      const response = await request(app)
        .get(`/api/reports/${sampleReportId}?include=deficiencies&deficiencies.severity=major`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deficiencies');
    });

    test('should return 404 for non-existent report', async () => {
      const response = await request(app)
        .get('/api/reports/550e8400-e29b-41d4-a716-999999999999')
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

  });

  describe('POST /api/reports', () => {
    const validReportData = {
      facilityId: 'test-hospital-automated',
      surveyType: 'infection_control',
      surveyDate: '2024-12-01T10:00:00Z',
      leadSurveyor: 'Dr. Automated Test',
      surveyScope: ['ICU', 'Emergency Department'],
      accreditationBody: 'Joint Commission',
      correctiveActionDue: '2024-12-31T23:59:59Z',
      followUpRequired: false
    };

    test('should create report with editor credentials', async () => {
      const facilityId = `test-${Date.now()}`;
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          ...validReportData,
          facilityId
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.facilityId).toBe(facilityId);
      expect(response.body.data.version).toBe(1);
      expect(response.body.data.status).toBe('compliant');
    });

    test('should create report with admin credentials', async () => {
      const facilityId = `admin-test-${Date.now()}`;
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validReportData,
          facilityId
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should deny reader from creating reports', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          ...validReportData,
          facilityId: `reader-test-${Date.now()}`
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

  });

  describe('PUT /api/reports/:id - Business Rules', () => {
    const compliantReportId = '550e8400-e29b-41d4-a716-446655440101';
    const immediateJeopardyId = '550e8400-e29b-41d4-a716-446655440103';

    test('should allow editor to update compliant reports', async () => {
      // Get current version first
      const getResponse = await request(app)
        .get(`/api/reports/${compliantReportId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      const currentVersion = getResponse.body.data.version;

      // Update the report
      const response = await request(app)
        .put(`/api/reports/${compliantReportId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          complianceScore: 92,
          version: currentVersion
        })
        .expect(200);

      expect(response.body.data.complianceScore).toBe(92);
      expect(response.body.data.version).toBe(currentVersion + 1);
    });

    test('should enforce business rule: editor cannot edit immediate jeopardy', async () => {
      // Get current version
      const getResponse = await request(app)
        .get(`/api/reports/${immediateJeopardyId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      const currentVersion = getResponse.body.data.version;

      // Try to update immediate jeopardy report as editor
      const response = await request(app)
        .put(`/api/reports/${immediateJeopardyId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          complianceScore: 80,
          version: currentVersion
        })
        .expect(403);

      expect(response.body.details.userRole).toBe('editor');
      expect(response.body.details.reportStatus).toBe('immediate_jeopardy');
      expect(response.body.details.requiredRole).toBe('admin');
    });

    test('should allow admin to edit immediate jeopardy reports', async () => {
      // Get current version
      const getResponse = await request(app)
        .get(`/api/reports/${immediateJeopardyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const currentVersion = getResponse.body.data.version;

      // Update as admin
      const response = await request(app)
        .put(`/api/reports/${immediateJeopardyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complianceScore: 68,
          followUpRequired: true,
          version: currentVersion
        })
        .expect(200);

      expect(response.body.data.complianceScore).toBe(68);
      expect(response.body.data.version).toBe(currentVersion + 1);
    });

  });

  describe('File Upload Tests', () => {
    const testReportId = '550e8400-e29b-41d4-a716-446655440101';

    test('should upload valid file as editor', async () => {
      const response = await request(app)
        .post(`/api/reports/${testReportId}/attachment`)
        .set('Authorization', `Bearer ${editorToken}`)
        .attach('attachment', Buffer.from('Test file content'), 'test-document.txt')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.originalName).toBe('test-document.txt');
      expect(response.body.data).toHaveProperty('fileId');
      expect(response.body.data).toHaveProperty('downloadUrl');
    });

    test('should upload valid file as admin', async () => {
      const response = await request(app)
        .post(`/api/reports/${testReportId}/attachment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('attachment', Buffer.from('Admin test file'), 'admin-file.txt')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should deny file upload for reader', async () => {
      const response = await request(app)
        .post(`/api/reports/${testReportId}/attachment`)
        .set('Authorization', `Bearer ${readerToken}`)
        .attach('attachment', Buffer.from('Reader file'), 'reader-file.txt')
        .expect(403);

      expect(response.body.success).toBe(false);
    });

  });

  describe('End-to-End User Flows', () => {
    test('should complete full CRUD workflow', async () => {
      // 1. Create report
      const facilityId = `e2e-test-${Date.now()}`;
      const createResponse = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          facilityId,
          surveyType: 'medication_management',
          surveyDate: '2024-12-01T10:00:00Z',
          leadSurveyor: 'Dr. E2E Test',
          surveyScope: ['Pharmacy'],
          accreditationBody: 'Joint Commission'
        })
        .expect(201);

      const reportId = createResponse.body.data.id;
      const initialVersion = createResponse.body.data.version;

      // 2. Read the report
      const getResponse = await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      expect(getResponse.body.data.facilityId).toBe(facilityId);

      // 3. Update the report
      const updateResponse = await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          complianceScore: 88,
          followUpRequired: true,
          version: initialVersion
        })
        .expect(200);

      expect(updateResponse.body.data.complianceScore).toBe(88);
      expect(updateResponse.body.data.version).toBe(initialVersion + 1);

      // 4. Upload file
      const uploadResponse = await request(app)
        .post(`/api/reports/${reportId}/attachment`)
        .set('Authorization', `Bearer ${editorToken}`)
        .attach('attachment', Buffer.from('E2E test document'), 'e2e-test.txt')
        .expect(201);

      expect(uploadResponse.body.success).toBe(true);

      // 5. Verify final state
      const finalGetResponse = await request(app)
        .get(`/api/reports/${reportId}?view=summary`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      expect(finalGetResponse.body.data.keyMetrics.complianceRate).toBe(88);
    });
  });

  describe('Error Handling', () => {
    test('should require authentication for protected endpoints', async () => {
      await request(app).get('/api/reports').expect(401);
      await request(app).post('/api/reports').expect(401);
      await request(app).put('/api/reports/550e8400-e29b-41d4-a716-446655440101').expect(401);
    });
  });
});