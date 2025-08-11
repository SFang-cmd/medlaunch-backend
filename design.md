# Backend API Design & Implementation - Design Document

## Overview

This project implements a hospital accreditation survey management API using Node.js with TypeScript. The system manages survey reports for healthcare facilities, following the requirements for complex formatting, authentication, file uploads, and async side effects. The architecture demonstrates production-quality patterns while maintaining simplicity for the challenge scope.

## Schema and Data Model

### Core Entity: Hospital Accreditation Survey Report

The system centers around **Survey Reports** - documents that capture the results of accreditation surveys conducted at healthcare facilities by organizations like the Joint Commission. The schema is based on the actual hospital accreditation processes, which I did research on to simulate a realistic use case of a backend API for Medlaunch.

#### Report Interface (13 Fields)

Based on actual hospital accreditation processes, each report contains some of the most important fields for a survey report, which tracks a hospital's required inspections, surveys, and any other regulatory requirements when being assessed for certification.

1. **`id: string`** - Unique survey report identifier
   - *Justification*: Primary key for REST API endpoints, enables direct access via GET /reports/{id}

2. **`facilityId: string`** - Unique facility id within the system  
   - *Justification*: Multi-facility systems need this relationship, enables queries like "all surveys for facility X"

3. **`surveyType: SurveyType`** - "comprehensive", "medication_management", "infection_control", "patient_safety"
   - *Justification*: Different survey types have different standards and permissions (comprehensive vs focused)
   - *Why limited*: Based on actual Joint Commission survey types, covers 90% of real-world scenarios

4. **`surveyDate: Date`** - The date of the survey
   - *Justification*: Critical business data for compliance timelines and audit trails

5. **`leadSurveyor: string`** - The surveyor leading the survey
   - *Justification*: Accountability and contact information for follow-up questions

6. **`surveyScope: string[]`** - Areas covered in this survey
   - *Justification*: Flexible array allows different scopes per survey (e.g., "ICU", "Emergency Department", "Pharmacy")
   - *Why simple strings*: YAGNI principle - start simple, add complexity only when business value is clear

7. **`complianceScore: number`** - Score result for this survey (0-100)
   - *Justification*: Quantifiable metric for sorting, filtering, and trend analysis

8. **`status: SurveyStatus`** - "compliant", "deficient", "immediate_jeopardy"
   - *Justification*: Business-critical field that determines required actions and permissions
   - *Immediate Jeopardy*: Critical status requiring immediate action and elevated permissions

9. **`accreditationBody: AccreditationBody`** - "Joint Commission", "ACHC", "DNV"
   - *Justification*: Top 3 hospital accreditation organizations in the US (covers 95%+ of market)
   - *Display names*: Human-readable for reports and UI

10. **`deficiencies: Deficiency[]`** - Array of deficiency objects
    - *Justification*: Core nested data structure that provides the "entries" requirement for complex formatting
    - **Structure**:

    ```typescript
    {
      id: string,                    // Unique identifier for individual deficiency
      standardCode: string,          // Regulatory standard violated (e.g., "IC.01.01", "MM.02.01")  
      description: string,           // Human-readable explanation of the violation
      severity: DeficiencySeverity,  // "minor" | "major" | "immediate_jeopardy"
      dueDate?: Date                 // Individual correction deadline
    }
    ```

11. **`correctiveActionDue: Date`** - Deadline for fixes
    - *Justification*: Regulatory requirement with legal implications if missed

12. **`followUpRequired: boolean`** - Needs additional survey
    - *Justification*: Business workflow flag that affects scheduling and resource allocation

13. **`surveyorNotes: string[]`** - Array of surveyor notes
    - *Justification*: Flexible array for unstructured but important contextual information
    - *Why simple strings*: Avoids over-engineering with timestamps, authors, categories

#### System Fields

- **`createdAt/updatedAt: Date`** - Standard audit trail
- **`version: number`** - Optimistic concurrency control for PUT operations

### Data Storage Design

The challenge asks for a NoSQL format without the actual database, so to ensure full functionality, I developed in-storage repository to simulate writing and reading from a NoSQL database such as MongoDB. Because the repository also returns JSON/dictionary formatted files, it is easily translatable to MongoDB and any other document-based database.

The database repository sample data is structured in arrays of json objects, with each object representing a report. Assuming we use a NoSQL structure, this structure mirrors directly what a MongoDB framework would query from.

Although we use arrays for ease of implementation, for production scale with thousands of reports, I would implement a Map-based lookup cache for O(1) ID access while maintaining the array for iteration and filtering operations, similar to how MongoDB would implement an index/report ID.

## Authentication and Authorization Model

### User Roles

User for login and authentication, just setting standard "reader", "editor", and "admin" roles:

```typescript
enum UserRole {
  READER = 'reader',    // Read-only access to reports
  EDITOR = 'editor',    // Create and edit reports  
  ADMIN = 'admin'       // Full access including sensitive operations
}
```

### JWT Implementation

- **Token Structure**: Contains minimal payload (id, role) for performance
- **Expiration**: 24 hour tokens
- **Security**: Assumes HTTPS transport, secure secret management
- **Stateless**: No server-side session storage required

### Sample Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Reader | `reader@medlaunch.com` | ReadPass123 |
| Editor | `editor@medlaunch.com` | EditPass123 |
| Admin | `admin@medlaunch.com` | AdminPass123 |

## Custom Business Rule Implementation

This API enforces a custom business rule to protect hospital accreditation data based on each report’s regulatory severity. Only users with the 'admin' role can edit reports marked with 'immediate_jeopardy' status due to their critical compliance impact. Reports labeled 'deficient' require an 'editor' or above for modifications, while lower-impact 'compliant' reports allow 'reader' access for note additions only. This rule is implemented through dedicated authorization middleware that validates the user's role against the report status before any edit action. By directly reflecting real-world governance needs, this rule safeguards critical survey data from unauthorized changes, ensures proper accountability, and influences both validation and API behavior.

### Primary Business Rule: Status-Based Edit Permissions

**Rule Definition**: "Survey reports with 'immediate_jeopardy' status can only be edited by users with 'admin' role. Reports with 'deficient' status require 'editor' role or higher. Only 'compliant' reports can be edited by 'reader' role for adding notes."

**Implementation**: Custom authorization middleware checks user role against report status before allowing modifications.

**Business Justification**: Immediate jeopardy findings have serious regulatory implications and require senior oversight. This prevents unauthorized modifications to critical compliance data that could affect a hospital's accreditation status.

### Secondary Business Rules

1. **Survey Uniqueness**: Only one survey of each type per facility per calendar year
2. **Facility-based access**: Users only see reports for their assigned facilities
3. **Version-based concurrency**: Prevents lost updates during simultaneous edits
4. **Time-based workflows**: Overdue `correctiveActionDue` dates trigger alerts

## API Endpoints Implementation

### 1. GET /reports/{id} - Complex Formatting Requirements

#### Multiple Output Shapes

The API supports multiple output shapes: default hierarchical JSON with full nested arrays, executive summary view with computed metrics (?view=summary), and flattened compact view with essential fields only (?include=basic). This provides flexibility for different client needs - mobile apps can use compact view, dashboards use summary view, and full applications use default view.

**Default View**: Rich hierarchical JSON with nested arrays

```http
GET /reports/123
```

**Executive Summary View**: Computed metrics with human-readable summary

```http
GET /reports/123?view=summary
```

Returns calculated fields like:

- `riskLevel`: "high" | "medium" | "low"  
- `keyMetrics`: Object with counts and percentages
- `executiveSummary`: Generated text like "Survey found 3 deficiencies, 1 requiring immediate attention. Overall compliance score: 78%." This is very much similar to the requested human-readable summary from the document.

**Compact/Flattened View**: Essential fields only, which conforms with the "executive summary" request from the document, as it is flattened.

```http
GET /reports/123?include=basic
```

#### Selective Expansion/Inclusion of Subfields

**Field Selection**:

```http
GET /reports/123?include=deficiencies,complianceScore,status
```

**Multiple Fields**:

```http
GET /reports/123?include=deficiencies,surveyorNotes,complianceScore
```

#### Pagination for Large Nested Lists

**Paginated Deficiencies**:

```http
GET /reports/123?include=deficiencies&page=1&limit=5
```

Returns pagination metadata:

```json
{
  "items": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3, 
    "totalItems": 12,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### Filtering/Sorting Inside Nested Collections

**Filter by Severity**:

```http  
GET /reports/123?deficiencies.severity=immediate_jeopardy
```

**Sort by Due Date**:

```http
GET /reports/123?deficiencies.sortBy=dueDate&deficiencies.order=asc  
```

**Combined Complex Query**:

```http
GET /reports/123?include=deficiencies&deficiencies.severity=major&deficiencies.sortBy=severity&page=1&limit=10
```

### 2. PUT /reports/{id} - Idempotent Updates

**Features Implemented**:

- Full and partial update semantics
- Optimistic concurrency control via version field  
- Structured input validation with field-level error details
- Audit logging of changes (who, what, when)

**Idempotency Mechanism**: Version-based conflict detection prevents lost updates when multiple users edit simultaneously.

### 3. POST /reports - Resource Creation

**Features Implemented**:

- Server-generated UUID identifiers
- Business invariant enforcement (survey uniqueness per facility/year)
- Input sanitization and validation  
- HTTP 201 Created response with Location header
- Asynchronous side effect with failure handling

**Business Rule**: Prevents duplicate surveys of same type for same facility in same calendar year.

**Async Side Effect**: Mock notification service simulates sending alerts via email/Slack when new surveys are created. Includes proper error handling and doesn't fail the main request if notification service is down.

### 4. POST /reports/{id}/attachment - File Upload

**Implementation Approach**:

- Multipart file upload using Multer middleware
- File type validation (MIME type checking)  
- Size restrictions (configurable limits)
- Abstracted storage layer (local disk for demo, cloud storage for production)
- Secure download URLs with expiration

**Security Considerations**: Files stored outside web root, virus scanning integration point defined, access logging for compliance.

## Concurrency Control Approach

### Optimistic Concurrency Control

**Method**: Version-based conflict detection using monotonically increasing version numbers.

**Implementation**:

1. Each report includes a `version` field
2. PUT requests must include the current version number
3. Server increments version on successful updates
4. Concurrent modification attempts are rejected with 409 Conflict
5. Client must refetch current version and retry

**Advantages**:

- High performance (no database locking)
- Scales horizontally across multiple server instances
- Clear semantics for conflict resolution

## File Storage and Access Security

### Storage Architecture

**Development**: Local filesystem storage for simplicity
**Production**: Cloud object storage (S3, Azure Blob, Google Cloud Storage)

### Security Measures

1. **File Validation**: MIME type and file signature verification
2. **Size Limits**: Configurable maximum file sizes prevent DoS attacks
3. **Access Control**: Signed URLs with configurable expiration times
4. **Virus Scanning**: Integration point for malware detection services
5. **Audit Trail**: All file operations logged for compliance

### Secure Download Implementation

**Signed URLs**: Time-limited URLs that prevent unauthorized access
**Integration**: Framework supports multiple storage backends
**Expiration**: Configurable timeouts (default 1 hour for downloads)

## Asynchronous Side Effect Strategy and Failure Handling

### Notification Service Implementation

**Purpose**: Demonstrates async side effects that don't block main request flow

**Features**:

- Mock notification service simulating email/Slack alerts  
- 10% artificial failure rate for realistic error handling
- Non-blocking execution (notification failures don't fail main request)
- Proper error logging for monitoring

**Failure Handling Strategy**:

```typescript
triggerAsyncNotification(report, userId).catch(error => {
  logger.error('Notification failed', error);
  // In production: queue for retry, dead letter processing
});
```

**Production Extensions**:

- Retry logic with exponential backoff
- Dead letter queue for failed notifications  
- Circuit breaker pattern for service resilience
- Message queue integration (Redis, RabbitMQ, AWS SQS)

## Code Quality Practices

### Type Safety and Validation

- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Zod Schemas**: Runtime validation for all API inputs with detailed error messages
- **Interface Contracts**: Clear separation between internal models and API contracts

### Architecture and Organization  

- **Layered Architecture**: Clean separation of Controller � Service � Repository layers
- **Single Responsibility**: Each module has one clear purpose
- **Dependency Injection**: Services can be easily mocked for testing

### Error Handling

- **Custom Error Classes**: Structured error types with HTTP status codes
- **Consistent Response Format**: All errors follow same JSON structure  
- **Client-Friendly Messages**: Actionable error descriptions

### Linting and Static Analysis

- **ESLint**: Enforced code style and quality rules
- **TypeScript Compiler**: Strict type checking with exactOptionalPropertyTypes
- **Import Organization**: Consistent module import structure

### Testing Philosophy  

- **Test Pyramid**: Unit tests for business logic, integration tests for API endpoints
- **Realistic Data**: Sample hospital survey data based on actual accreditation scenarios
- **Mocking Strategy**: External services mocked, core business logic tested directly

### Logging and Observability

- **Structured Logging**: JSON format with consistent fields across all services
- **Request Correlation**: Request IDs for tracing requests across service layers
- **Context Logging**: User ID, action type, and resource information included
- **Error Tracking**: Full error stack traces with contextual metadata

## Scaling and Observability Considerations

### Horizontal Scaling Support

**Stateless Design**: JWT-based authentication enables load balancing across multiple server instances without session affinity requirements.

**Database Strategy**: NoSQL document model (simulated with arrays) supports horizontal partitioning by facility ID or date ranges.

**Caching Layer**: Framework in place for distributed caching implementation using Redis.

### Thoughtful Data Access

**Indexing Strategy**:

- Primary index on report ID (UUID)
- Composite index on facilityId + surveyType + surveyDate
- Secondary indexes on status and complianceScore for dashboard queries

**Pagination Implementation**: Cursor-based pagination for nested collections prevents performance degradation with large datasets.

**Query Optimization**: Selective field inclusion minimizes data transfer and improves API response times.

### Observability Framework

**Health Checks**: `/health` endpoint for load balancer and monitoring integration
**Metrics Collection**: Structured logging supports integration with Prometheus/Grafana  
**Request Tracing**: Request correlation IDs enable distributed tracing
**Performance Monitoring**: Response time and error rate tracking built into logging

## Technology Choices and Justifications

### Express.js Framework Selection

I used Express because during my initial conversation with Robert, he mentioned that Medlaunch Concepts currently uses the MERN stack, which expressly uses Express.js as part of its stack. For larger production systems, I would consider switching to NestJS, which is a more modern and feature-rich framework that is built on top of Express.js. However, Express demonstrates the same underlying patterns that would be used in NestJS and demonstrates the underlying patterns without framework abstraction.

### Supporting Technology Decisions

**Zod for Validation**: TypeScript-first validation with excellent error messages and type inference
**Winston for Logging**: Multi-transport logging with structured JSON output  
**JWT for Authentication**: Stateless tokens that scale horizontally
**Multer for File Uploads**: Standard Express middleware with flexible storage backends

## Evolution and Next Steps

### API Versioning Strategy

Header-based versioning would support backward compatibility as the API evolves

### Additional Survey Types

New survey types can be added by extending the SurveyType enum with automatic validation

### Advanced Metrics

Plugin architecture would allow hot-swappable metric calculation modules

### Production Deployment

- Containerization with Docker multi-stage builds
- Infrastructure as Code using Terraform
- CI/CD pipeline with automated testing and deployment
- Database clustering with MongoDB replica sets

This design balances regulatory realism with API implementation practicality while maintaining the flexibility to evolve as business requirements emerge.
