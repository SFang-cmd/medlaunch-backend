import request from 'supertest';
import { app, sampleReportIds, getAuthToken } from './setup';
import fs from 'fs';
import path from 'path';

describe('POST /api/reports/:id/attachment - File Upload', () => {
  const testFilesDir = path.join(__dirname, 'test-files');
  
  // Setup test files before running tests
  beforeAll(async () => {
    // Create test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Create test files of different types
    const testFiles = {
      'valid-document.txt': 'This is a valid survey document for testing file uploads.',
      'survey-report.pdf': '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n', // Minimal PDF
      'large-file.txt': 'a'.repeat(15 * 1024 * 1024), // 15MB file (exceeds limit)
      'malicious-file.exe': 'MZ\x90\x00', // Executable file signature
      'empty-file.txt': '', // Empty file
      'image-test.jpg': '\xFF\xD8\xFF\xE0\x00\x10JFIF', // JPEG file signature
    };

    for (const [filename, content] of Object.entries(testFiles)) {
      fs.writeFileSync(path.join(testFilesDir, filename), content);
    }
  });

  // Cleanup test files after running tests
  afterAll(async () => {
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('User Flow: Authentication + File Upload', () => {
    test('should complete full flow: login as editor -> upload valid file -> verify response', async () => {
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

      // Step 2: Verify target report exists
      const reportResponse = await request(app)
        .get(`/api/reports/${sampleReportIds.compliant}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(reportResponse.body.success).toBe(true);
      expect(reportResponse.body.data.id).toBe(sampleReportIds.compliant);

      // Step 3: Upload file to the report
      const filePath = path.join(testFilesDir, 'valid-document.txt');
      
      const uploadResponse = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', filePath)
        .expect(201);

      // Step 4: Verify upload response
      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data).toHaveProperty('fileId');
      expect(uploadResponse.body.data).toHaveProperty('originalName');
      expect(uploadResponse.body.data).toHaveProperty('size');
      expect(uploadResponse.body.data).toHaveProperty('mimetype');
      expect(uploadResponse.body.data).toHaveProperty('downloadUrl');
      expect(uploadResponse.body.data).toHaveProperty('uploadedAt');
      
      expect(uploadResponse.body.data.originalName).toBe('valid-document.txt');
      expect(uploadResponse.body.data.mimetype).toBe('text/plain');
      expect(uploadResponse.body.data.size).toBeGreaterThan(0);
      expect(uploadResponse.body.message).toBe('File uploaded successfully');

      // Step 5: Verify file was actually saved to disk
      const uploadDir = process.env.UPLOAD_PATH || './uploads';
      const files = fs.readdirSync(uploadDir);
      const uploadedFile = files.find(f => f.includes(sampleReportIds.compliant));
      expect(uploadedFile).toBeDefined();
    });

    test('should allow admin to upload files', async () => {
      const token = await getAuthToken('admin');
      const filePath = path.join(testFilesDir, 'valid-document.txt');

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.deficient}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', filePath)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should deny reader from uploading files', async () => {
      const token = await getAuthToken('reader');
      const filePath = path.join(testFilesDir, 'valid-document.txt');

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', filePath)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('File Type Validation', () => {
    test('should accept valid file types', async () => {
      const token = await getAuthToken('editor');

      // Test various allowed file types
      const validFiles = [
        { file: 'valid-document.txt', expectedType: 'text/plain' },
        { file: 'image-test.jpg', expectedType: 'image/jpeg' }
      ];

      for (const { file, expectedType } of validFiles) {
        const filePath = path.join(testFilesDir, file);
        
        const response = await request(app)
          .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
          .set('Authorization', `Bearer ${token}`)
          .attach('attachment', filePath)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.mimetype).toBe(expectedType);
      }
    });

    test('should reject invalid file types', async () => {
      const token = await getAuthToken('editor');
      const filePath = path.join(testFilesDir, 'malicious-file.exe');

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', filePath)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(response.body.error.message).toContain('not allowed');
    });
  });

  describe('File Size Validation', () => {
    test('should reject files exceeding size limit', async () => {
      const token = await getAuthToken('editor');
      const filePath = path.join(testFilesDir, 'large-file.txt');

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', filePath)
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
      expect(response.body.error.message).toContain('exceeds the maximum limit');
    });

    test('should accept files within size limit', async () => {
      const token = await getAuthToken('editor');
      
      // Create a file just under the limit (assume 10MB limit)
      const smallFilePath = path.join(testFilesDir, 'small-file.txt');
      const content = 'a'.repeat(1024 * 1024); // 1MB file
      fs.writeFileSync(smallFilePath, content);

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', smallFilePath)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.size).toBe(content.length);

      // Cleanup
      fs.unlinkSync(smallFilePath);
    });
  });

  describe('File Upload Edge Cases', () => {
    test('should reject request with no file', async () => {
      const token = await getAuthToken('editor');

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(response.body.error.message).toBe('No file provided');
    });

    test('should handle empty files', async () => {
      const token = await getAuthToken('editor');
      const filePath = path.join(testFilesDir, 'empty-file.txt');

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', filePath)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.size).toBe(0);
    });

    test('should reject upload to non-existent report', async () => {
      const token = await getAuthToken('editor');
      const filePath = path.join(testFilesDir, 'valid-document.txt');

      const response = await request(app)
        .post('/api/reports/550e8400-e29b-41d4-a716-999999999999/attachment')
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', filePath)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });

    test('should reject upload with invalid report ID', async () => {
      const token = await getAuthToken('editor');
      const filePath = path.join(testFilesDir, 'valid-document.txt');

      const response = await request(app)
        .post('/api/reports/invalid-uuid/attachment')
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', filePath)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should handle multiple file upload attempts (should reject)', async () => {
      const token = await getAuthToken('editor');
      const filePath1 = path.join(testFilesDir, 'valid-document.txt');
      const filePath2 = path.join(testFilesDir, 'image-test.jpg');

      // Try to upload multiple files (should be rejected as we only allow single file)
      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', filePath1)
        .attach('attachment2', filePath2)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOO_MANY_FILES');
    });
  });

  describe('File Storage and Security', () => {
    test('should generate unique filenames for uploads', async () => {
      const token = await getAuthToken('editor');
      const filePath = path.join(testFilesDir, 'valid-document.txt');
      const uploadedFilenames: string[] = [];

      // Upload same file multiple times
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
          .set('Authorization', `Bearer ${token}`)
          .attach('attachment', filePath)
          .expect(201);

        // Extract filename from download URL
        const downloadUrl = response.body.data.downloadUrl;
        const filename = downloadUrl.split('/').pop();
        uploadedFilenames.push(filename);

        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // All filenames should be unique
      const uniqueFilenames = new Set(uploadedFilenames);
      expect(uniqueFilenames.size).toBe(uploadedFilenames.length);

      // All should contain the report ID and timestamp pattern
      uploadedFilenames.forEach(filename => {
        expect(filename).toContain(sampleReportIds.compliant);
        expect(filename).toMatch(/\d+\.txt$/); // timestamp + extension
      });
    });

    test('should preserve original file extension', async () => {
      const token = await getAuthToken('editor');
      
      const testCases = [
        { file: 'valid-document.txt', expectedExt: '.txt' },
        { file: 'image-test.jpg', expectedExt: '.jpg' }
      ];

      for (const { file, expectedExt } of testCases) {
        const filePath = path.join(testFilesDir, file);
        
        const response = await request(app)
          .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
          .set('Authorization', `Bearer ${token}`)
          .attach('attachment', filePath)
          .expect(201);

        const downloadUrl = response.body.data.downloadUrl;
        expect(downloadUrl).toContain(expectedExt);
      }
    });

    test('should include security metadata in response', async () => {
      const token = await getAuthToken('editor');
      const filePath = path.join(testFilesDir, 'valid-document.txt');

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', filePath)
        .expect(201);

      // Verify security-related fields
      expect(response.body.data.fileId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(response.body.data.uploadedAt).toBeDefined();
      expect(new Date(response.body.data.uploadedAt).getTime()).toBeLessThanOrEqual(Date.now());

      // Download URL should follow expected pattern
      expect(response.body.data.downloadUrl).toContain('/api/reports/');
      expect(response.body.data.downloadUrl).toContain('/attachments/');
    });
  });

  describe('Error Handling and Authentication', () => {
    test('should require authentication', async () => {
      const filePath = path.join(testFilesDir, 'valid-document.txt');

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .attach('attachment', filePath)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should handle invalid JWT tokens', async () => {
      const filePath = path.join(testFilesDir, 'valid-document.txt');

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', 'Bearer invalid-token')
        .attach('attachment', filePath)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should provide consistent error format', async () => {
      const token = await getAuthToken('editor');

      const response = await request(app)
        .post(`/api/reports/${sampleReportIds.compliant}/attachment`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400); // No file provided

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });
});