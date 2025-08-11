# Hospital Accreditation Survey Management API

A Node.js TypeScript backend API for managing hospital accreditation survey reports with advanced querying, role-based authentication, and file upload capabilities.

## Features

- **Complex Report Querying**: Multiple output formats, nested filtering, pagination
- **Role-Based Authentication**: JWT with reader/editor/admin permissions  
- **File Upload Management**: Secure attachment handling with validation
- **Async Side Effects**: Non-blocking notification system
- **Production-Ready**: Comprehensive logging, error handling, and validation

## Quick Start

### Prerequisites

- Node.js 18+
- npm 8+

### Installation and Setup

1. **Clone and Install Dependencies**

```bash
git clone <repository-url>
cd medlaunch-backend
npm install
```

2. **Environment Configuration**

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# JWT Configuration - CHANGE IN PRODUCTION
JWT_SECRET=your-super-secure-secret-key-here-make-it-long-and-random
JWT_EXPIRES_IN=24h

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=info
```

3. **Start Development Server**

```bash
npm run dev
```

Server runs on `http://localhost:3000`

### Verify Installation

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-08-11T07:00:00.000Z", 
  "environment": "development"
}
```

## Authentication Usage

### Sample Test Accounts

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| Reader | `reader@medlaunch.com` | `ReadPass123` | View reports only |
| Editor | `editor@medlaunch.com` | `EditPass123` | Create and edit reports |
| Admin | `admin@medlaunch.com` | `AdminPass123` | Full access |

### Getting Access Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "editor@medlaunch.com",
    "password": "EditPass123"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "email": "editor@medlaunch.com", 
      "name": "John Editor",
      "role": "editor"
    },
    "expiresIn": "24h"
  }
}
```

### Using the Token

Include the token in the Authorization header for protected endpoints:

```bash
Authorization: Bearer your-jwt-token-here
```

## API Documentation and Examples

### Base URL

```bash
http://localhost:3000/api
```

### 1. GET /reports/{id} - Retrieve Survey Report

#### Basic Usage

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440100
```

#### Advanced Query Examples

**Executive Summary View**:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440103?view=summary"
```

**Selective Field Inclusion**:

```bash  
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440100?include=deficiencies,complianceScore"
```

**Filtered Deficiencies**:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440103?include=deficiencies&deficiencies.severity=immediate_jeopardy"
```

**Paginated Results**:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440103?include=deficiencies&page=1&limit=2"
```

**Complex Combined Query**:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440103?include=deficiencies&deficiencies.severity=major&deficiencies.sortBy=dueDate&page=1&limit=5"
```

### 2. POST /reports - Create New Survey Report

**Required Role**: Editor or Admin

```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "facilityId": "new-hospital-123",
    "surveyType": "infection_control",
    "surveyDate": "2024-12-01T10:00:00Z", 
    "leadSurveyor": "Dr. Test Surveyor",
    "surveyScope": ["ICU", "Emergency Department"],
    "accreditationBody": "Joint Commission",
    "correctiveActionDue": "2024-12-31T23:59:59Z",
    "followUpRequired": false
  }'
```

Expected Response (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "generated-uuid-here",
    "facilityId": "new-hospital-123",
    "surveyType": "infection_control", 
    "complianceScore": 0,
    "status": "compliant",
    "deficiencies": [],
    "version": 1,
    "createdAt": "2024-08-11T07:00:00.000Z"
  },
  "message": "Survey report created successfully"
}
```

### 3. PUT /reports/{id} - Update Survey Report

**Required Role**: Editor or Admin (with status-based restrictions)

#### Basic Update

```bash
curl -X PUT http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440101 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "complianceScore": 92,
    "followUpRequired": true,
    "version": 1
  }'
```

#### Business Rule Enforcement

- **Immediate Jeopardy reports** can only be edited by **Admin** users
- **Deficient reports** can be edited by **Editor** and **Admin** users  
- **Compliant reports** can be edited by all authenticated users

#### Optimistic Concurrency Control

Always include the current `version` number to prevent conflicts:

```bash
# Step 1: Get current version
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440101

# Step 2: Update with version number from Step 1
curl -X PUT http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440101 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "complianceScore": 95,
    "version": 2
  }'
```

Expected Response (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440101",
    "complianceScore": 95,
    "version": 3,
    "updatedAt": "2024-08-11T20:00:00.000Z"
  },
  "message": "Survey report updated successfully"
}
```

### 4. POST /reports/{id}/attachment - Upload File Attachment

**Required Role**: Editor or Admin

#### Upload Document

```bash
curl -X POST http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440101/attachment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "attachment=@survey-documentation.pdf"
```

#### Supported File Types

- PDF documents (`.pdf`)
- Word documents (`.doc`, `.docx`)
- Excel spreadsheets (`.xls`, `.xlsx`)
- Images (`.jpg`, `.jpeg`, `.png`, `.tiff`)
- Text files (`.txt`)

#### File Size Limits

- Maximum file size: **10MB** (configurable via `MAX_FILE_SIZE` env variable)
- Single file per upload request

Expected Response (201 Created):

```json
{
  "success": true,
  "data": {
    "fileId": "generated-uuid-here",
    "originalName": "survey-documentation.pdf",
    "size": 245760,
    "mimetype": "application/pdf",
    "downloadUrl": "/api/reports/550e8400-e29b-41d4-a716-446655440101/attachments/filename.pdf",
    "uploadedAt": "2024-08-11T20:00:00.000Z"
  },
  "message": "File uploaded successfully"
}
```

#### Upload Validation Errors

```bash
# File too large (413 Payload Too Large)
curl -X POST http://localhost:3000/api/reports/REPORT_ID/attachment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "attachment=@large-file.pdf"

# Invalid file type (400 Bad Request)  
curl -X POST http://localhost:3000/api/reports/REPORT_ID/attachment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "attachment=@malicious-file.exe"

# No file provided (400 Bad Request)
curl -X POST http://localhost:3000/api/reports/REPORT_ID/attachment \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. GET /reports - List All Reports

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/reports
```

### Query Parameters Reference

| Parameter | Description | Example |
|-----------|-------------|---------|
| `view` | Output format: `default` or `summary` | `?view=summary` |
| `include` | Comma-separated field list or `basic` | `?include=deficiencies,status` |
| `page` | Page number for pagination | `?page=2` |  
| `limit` | Items per page (max 100) | `?limit=10` |
| `deficiencies.severity` | Filter by severity level | `?deficiencies.severity=major` |
| `deficiencies.sortBy` | Sort deficiencies by field | `?deficiencies.sortBy=dueDate` |
| `deficiencies.order` | Sort order: `asc` or `desc` | `?deficiencies.order=asc` |

## Sample Data Overview

The system includes 5 sample hospital survey reports:

1. **Mercy General Hospital** - Infection Control Survey (Deficient)
   - ID: `550e8400-e29b-41d4-a716-446655440100`
   - 3 deficiencies including 1 immediate jeopardy finding

2. **St. Mary's Medical Center** - Medication Management (Compliant)  
   - ID: `550e8400-e29b-41d4-a716-446655440101`
   - High performing with only 1 minor deficiency

3. **Riverside Community Hospital** - Comprehensive Survey (Compliant)
   - ID: `550e8400-e29b-41d4-a716-446655440102`
   - Perfect score with zero deficiencies

4. **Metro General Hospital** - Patient Safety (Immediate Jeopardy)
   - ID: `550e8400-e29b-41d4-a716-446655440103`
   - Critical findings requiring immediate action

5. **Northside Medical Center** - Medication Management (Deficient)
   - ID: `550e8400-e29b-41d4-a716-446655440104`
   - Multiple medication safety issues

## Custom Business Rule

**Status-Based Edit Permissions**: Survey reports with 'immediate_jeopardy' status can only be edited by users with 'admin' role. Reports with 'deficient' status require 'editor' role or higher. Only 'compliant' reports can be edited by 'reader' role for adding notes.

**Survey Uniqueness Rule**: Only one survey of each type per facility per calendar year is allowed.

## Development Commands

```bash
# Development with hot reload
npm run dev

# Build TypeScript  
npm run build

# Run production build
npm run start

# Run tests
npm run test

# Type checking
npm run typecheck

# Code linting
npm run lint

# Fix linting issues  
npm run lint:fix
```

## Project Structure

```text
src/
├── api/                   # API route handlers
│   ├── auth/
│   │   └── index.ts       # Authentication routes  
│   └── reports/
│       └── index.ts       # Report CRUD routes
├── controllers/           # HTTP request controllers
│   ├── authController.ts
│   └── reportController.ts  
├── services/              # Business logic layer
│   ├── authService.ts
│   ├── reportService.ts
│   ├── reportRepository.ts # Sample data management
│   └── userRepository.ts
├── middleware/            # Express middleware
│   ├── auth.ts           # Authentication & authorization
│   ├── logger.ts         # Request logging
│   ├── errorHandler.ts   # Global error handling
│   └── upload.ts         # File upload handling
├── models/               # TypeScript interfaces  
│   ├── report.ts
│   └── user.ts
├── utils/                # Utilities and helpers
│   ├── validators.ts     # Zod validation schemas
│   ├── errors.ts         # Custom error classes
│   └── logger.ts         # Winston logger setup
├── config/               # Configuration management
│   └── index.ts
└── app.ts               # Express application setup
```

## Error Handling

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message", 
    "timestamp": "2024-08-11T07:00:00.000Z",
    "requestId": "correlation-id",
    "details": {
      "field": "specific error details"  
    }
  }
}
```

Common error codes:

- `VALIDATION_ERROR` - Invalid request data
- `NOT_FOUND` - Resource does not exist  
- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `CONFLICT` - Business rule violation

## Testing the API

### Using cURL

All examples above use cURL commands that can be run directly in your terminal.

### Using Postman

1. Import the provided examples as a Postman collection
2. Set up environment variables for `baseUrl` and `authToken`
3. Use the login endpoint to get a token
4. Test all endpoints with different user roles

### Integration Testing

```bash
# Run the test suite
npm test

# Run tests with coverage
npm run test -- --coverage
```

## Production Considerations

### Security

- Change JWT secret to a strong random value
- Enable HTTPS in production
- Configure CORS for your frontend domain
- Set up rate limiting
- Enable request size limits

### Performance

- Use a production database (MongoDB recommended)
- Set up Redis for caching
- Configure file storage (AWS S3, etc.)
- Enable gzip compression
- Set up CDN for static assets

### Monitoring

- Configure structured logging destination
- Set up health check monitoring
- Enable error tracking (Sentry, etc.)
- Monitor API performance metrics

### Deployment

- Use Docker containers
- Set up CI/CD pipeline
- Configure environment-specific settings
- Set up database backups
- Plan for horizontal scaling

## Support

For questions or issues:

1. Check the API error response for specific guidance
2. Review the design.md document for architecture details  
3. Examine the sample data in `src/services/reportRepository.ts`
4. Test with different user roles to understand permissions

## License

This project is part of a coding challenge demonstration.
