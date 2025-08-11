# Data Model Design Justifications

## Architecture Decisions

### **Express.js Framework Choice**

I used Express because during my initial conversation with Robert, he mentioned that Medlaunch Concepts currently uses the MERN stack, which expressly uses Express.js as part of its stack. For larger production systems, I would consider switching to NestJS, which is a more modern and feature-rich framework that is built on top of Express.js. However, Express demonstrates the same underlying patterns that would be used in NestJS and demonstrates the underlying patterns without framework abstraction.

### **No Database/Repository Subdirectories**

We don't include databases or repositories subdirectories, since these are not being set up. If these were, then we would need to set up those directories, but for the sake of the challenge, we will use sample data, as the service/business logic seems more important.

The database repository sample data is structured in arrays of json objects, with each object representing a report. Assuming we use a NoSQL structure, this structure mirrors directly what a MongoDB framework would query from.

Although we use arrays for ease of implementation, for production scale with thousands of reports, I would implement a Map-based lookup cache for O(1) ID access while maintaining the array for iteration and filtering operations, similar to how MongoDB would implement an index/report ID.

### **Authentication Model**

User for login and authentication, just setting standard "reader", "writer", and "admin" roles.

## Core Report Structure - Hospital Accreditation Survey

### **Report Interface (13 Fields with Justifications)**

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
   - *Justification*: Flexible array allows different scopes per survey (e.g., "patient_safety_goals", "medication_management", "infection_prevention", "leadership_standards")
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
    - *Simplified from original*: Removed unnecessary fields like category, correctionRequired, correctionPlan, assignedTo

11. **`correctiveActionDue: Date`** - Deadline for fixes
    - *Justification*: Regulatory requirement with legal implications if missed

12. **`followUpRequired: boolean`** - Needs additional survey
    - *Justification*: Business workflow flag that affects scheduling and resource allocation

13. **`surveyorNotes: string[]`** - Array of surveyor notes
    - *Justification*: Flexible array for unstructured but important contextual information
    - *Why simple strings*: Avoids over-engineering with timestamps, authors, categories

### **System Fields**
- **`createdAt/updatedAt: Date`** - Standard audit trail
- **`version: number`** - Optimistic concurrency control for PUT operations

## Design Decisions

### **Why No ReportSummary Interface?**
- **Decision**: Generate summary dynamically from Report data using `?view=summary` query parameter
- **Justification**: 
  - Eliminates data duplication and sync issues
  - Summary logic can evolve without schema changes  
  - Single source of truth principle
  - Computed fields like "X deficiencies found" are more accurate when calculated real-time
  - Executive summary can be generated as: "Survey found {deficiencies.length} deficiencies, {immediateJeopardyCount} requiring immediate attention. Overall compliance score: {complianceScore}%."

### **Streamlined Enum Values**
- **SurveyType**: 4 core types instead of 7+ options
- **AccreditationBody**: 3 major bodies instead of comprehensive list
- **DeficiencySeverity**: Standard 3-tier classification
- *Justification*: Too many options create complexity without business value for this challenge

### **Simple Arrays Over Complex Objects**
- **surveyScope: string[]** instead of enum-based objects
- **surveyorNotes: string[]** instead of timestamped/categorized objects
- *Justification*: Flexibility without premature optimization - easier to query and display

## API Endpoints

### **Get Reports Parameters***

The API supports multiple output shapes: default hierarchical JSON with full nested arrays, executive summary view with computed metrics (?view=summary), and flattened compact view with essential fields only (?include=basic). This provides flexibility for different client needs - mobile apps can use compact view, dashboards use summary view, and full applications use default view.

The get reports endpoint has a number of parameters that can be used to filter the results. These parameters are:

- `view`: The view to return. Can be "default" or "summary". Default is "default". "Summary" returns a summary of the report with key metrics and an `executiveSummary` field, while "default" returns the full report.
- `include`: The fields to include. Can be a comma separated list of fields. The "basic" parameter can be used, to view a "flattened" version of the data with only select fields.
- `page`: The page number to return. Default is 1.
- `limit`: The number of results to return. Default is 20.
- `sortBy`: The field to sort by. Default is "updatedAt".
- `sortOrder`: The order to sort by. Can be "asc" or "desc". Default is "desc".

## Business Rules Enabled by This Structure

### **Custom Business Rule: Status-Based Edit Permissions**
*"Survey reports with 'immediate_jeopardy' status can only be edited by users with 'admin' role. Reports with 'deficient' status require 'editor' role or higher. Only 'compliant' reports can be edited by 'reader' role for adding notes."*

**Additional Rules:**
1. **Survey type permissions**: Different survey types may require clinical specialist access
2. **Facility-based access**: Users only see reports for their assigned facilities  
3. **Time-based workflows**: Overdue `correctiveActionDue` dates trigger alerts
4. **Version-based concurrency**: Prevents lost updates during simultaneous edits

This design balances regulatory realism with API implementation practicality while maintaining the flexibility to evolve as business requirements emerge.