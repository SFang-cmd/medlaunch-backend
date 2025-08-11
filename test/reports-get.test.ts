import request from 'supertest';
import { app, authenticatedRequest, sampleReportIds } from './setup';

describe('GET /api/reports', () => {
  describe('GET /api/reports - List all reports', () => {
    test('should return all reports for authenticated user', async () => {
      const req = await authenticatedRequest('get', '/api/reports');
      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta).toHaveProperty('total');
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/reports')
        .expect(401);
    });
  });

  describe('GET /api/reports/:id - Get specific report', () => {
    test('should return report with default view', async () => {
      const req = await authenticatedRequest('get', `/api/reports/${sampleReportIds.compliant}`);
      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('facilityId');
      expect(response.body.data).toHaveProperty('surveyType');
      expect(response.body.data).toHaveProperty('deficiencies');
      expect(response.body.data.id).toBe(sampleReportIds.compliant);
    });

    test('should return executive summary view', async () => {
      const req = await authenticatedRequest('get', `/api/reports/${sampleReportIds.immediateJeopardy}?view=summary`);
      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('executiveSummary');
      expect(response.body.data).toHaveProperty('riskLevel');
      expect(response.body.data).toHaveProperty('keyMetrics');
      expect(response.body.data).toHaveProperty('criticalIssues');
      expect(response.body.data).toHaveProperty('actionRequired');
      
      // Should be high risk due to immediate jeopardy
      expect(response.body.data.riskLevel).toBe('high');
      expect(response.body.data.keyMetrics.immediateJeopardyCount).toBeGreaterThan(0);
    });

    test('should return basic view with selective inclusion', async () => {
      const req = await authenticatedRequest('get', `/api/reports/${sampleReportIds.compliant}?include=basic`);
      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('facilityId');
      expect(response.body.data).toHaveProperty('surveyType');
      expect(response.body.data).toHaveProperty('complianceScore');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('surveyDate');
      
      // Should not have full nested data
      expect(response.body.data).not.toHaveProperty('surveyorNotes');
      expect(response.body.data).not.toHaveProperty('deficiencies');
    });

    test('should return selective fields', async () => {
      const req = await authenticatedRequest('get', `/api/reports/${sampleReportIds.deficient}?include=deficiencies,complianceScore`);
      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('deficiencies');
      expect(response.body.data).toHaveProperty('complianceScore');
      
      // Should not have other fields
      expect(response.body.data).not.toHaveProperty('surveyorNotes');
      expect(response.body.data).not.toHaveProperty('leadSurveyor');
    });

    test('should filter deficiencies by severity', async () => {
      const req = await authenticatedRequest('get', `/api/reports/${sampleReportIds.immediateJeopardy}?include=deficiencies&deficiencies.severity=immediate_jeopardy`);
      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deficiencies');
      
      const deficiencies = response.body.data.deficiencies;
      expect(deficiencies.length).toBeGreaterThan(0);
      
      // All returned deficiencies should be immediate jeopardy
      deficiencies.forEach((deficiency: any) => {
        expect(deficiency.severity).toBe('immediate_jeopardy');
      });
    });

    test('should sort deficiencies by severity', async () => {
      const req = await authenticatedRequest('get', `/api/reports/${sampleReportIds.immediateJeopardy}?include=deficiencies&deficiencies.sortBy=severity&deficiencies.order=desc`);
      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deficiencies');
      
      const deficiencies = response.body.data.deficiencies;
      if (deficiencies.length > 1) {
        // Should be sorted with immediate_jeopardy first
        expect(deficiencies[0].severity).toBe('immediate_jeopardy');
      }
    });

    test('should paginate deficiencies', async () => {
      const req = await authenticatedRequest('get', `/api/reports/${sampleReportIds.immediateJeopardy}?include=deficiencies&page=1&limit=2`);
      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deficiencies');
      
      const result = response.body.data.deficiencies;
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toHaveProperty('currentPage');
      expect(result.pagination).toHaveProperty('totalPages');
      expect(result.pagination).toHaveProperty('totalItems');
      expect(result.items.length).toBeLessThanOrEqual(2);
    });

    test('should return 404 for non-existent report', async () => {
      const req = await authenticatedRequest('get', '/api/reports/550e8400-e29b-41d4-a716-999999999999');
      await req.expect(404);
    });

    test('should return 400 for invalid UUID', async () => {
      const req = await authenticatedRequest('get', '/api/reports/invalid-uuid');
      await req.expect(400);
    });

    test('should work for all user roles', async () => {
      // Test with reader
      const readerReq = await authenticatedRequest('get', `/api/reports/${sampleReportIds.compliant}`, 'reader');
      await readerReq.expect(200);

      // Test with editor  
      const editorReq = await authenticatedRequest('get', `/api/reports/${sampleReportIds.compliant}`, 'editor');
      await editorReq.expect(200);

      // Test with admin
      const adminReq = await authenticatedRequest('get', `/api/reports/${sampleReportIds.compliant}`, 'admin');
      await adminReq.expect(200);
    });
  });
});