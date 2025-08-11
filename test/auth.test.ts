import request from 'supertest';
import { app, testUsers } from './setup';

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/login', () => {
    test('should login with valid editor credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(testUsers.editor)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.role).toBe('editor');
      expect(response.body.data.user.email).toBe(testUsers.editor.email);
      expect(response.body.data).toHaveProperty('expiresIn');
    });

    test('should login with valid admin credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(testUsers.admin)
        .expect(200);

      expect(response.body.data.user.role).toBe('admin');
    });

    test('should login with valid reader credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(testUsers.reader)
        .expect(200);

      expect(response.body.data.user.role).toBe('reader');
    });

    test('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@medlaunch.com',
          password: 'EditPass123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'editor@medlaunch.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'EditPass123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should require password minimum length', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'editor@medlaunch.com',
          password: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Authentication Middleware', () => {
    test('should reject request without token', async () => {
      await request(app)
        .get('/api/reports')
        .expect(401);
    });

    test('should reject request with invalid token', async () => {
      await request(app)
        .get('/api/reports')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('should reject request with malformed authorization header', async () => {
      await request(app)
        .get('/api/reports')
        .set('Authorization', 'invalid-format')
        .expect(401);
    });
  });
});