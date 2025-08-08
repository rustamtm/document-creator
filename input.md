# ServiceNow Integration Implementation Plan: Workday to SNOW Time Card Ingestion (INT005)

**Prepared for:** ServiceNow Developer Team
**Platform Version:** Zurich
**Date:** August 2025

---

## 1. Purpose

This document outlines the step-by-step implementation plan for integrating Workday time entry data into ServiceNow using Web Service Import Sets. The goal is to automatically create or update weekly time card records in the `time_card` table based on Workday inputs via MuleSoft.

---

## 2. Overview of Process

| Source System | Middleware | Target System |
| ------------- | ---------- | ------------- |
| Workday RaaS  | MuleSoft   | ServiceNow    |

Workday exposes a time entry report which is pulled by MuleSoft. This data is transformed and sent to ServiceNow as HTTP requests to a Web Service Import Set, which stages data and transforms it into `time_card` records.

---

## 3. Tables Involved

### 3.1 Source (Import Set Table)

* **Name:** `imp_workday_timecards`
* **Type:** Web Service Import Set (WSIS)
* **Fields:**

  * `employee_id` (String, required, 6-digit EEID)
  * `work_order` (String, required, Workday worktag field)
  * `project_number` (String, optional)
  * `week_starts_on` (Date, required, always Saturday)
  * `expense_type` (String, optional, derived from Account worktag)
  * `time_blocks` (Array of `{date, hours}` objects)

### 3.2 Target

* **Primary Table:** `time_card`
* **Supporting Tables:** `sys_user`, `pm_project`, `time_card_daily` (auto-generated)

---

## 4. Implementation Steps

### 4.1 Create Web Service Import Set Table

1. Navigate to: `System Web Services > Inbound > Create New`
2. Name: `imp_workday_timecards`
3. Label: `Workday Timecard Import`
4. Enable:

   * ☑ Create Transform Map
   * ☑ Web Service Import Set Mode: **Synchronous**
5. Define all required fields listed in Section 3.1
6. Click **Create**

### 4.2 Create Transform Map

* **Source Table:** `imp_workday_timecards`
* **Target Table:** `time_card`
* **Coalesce Fields:** `employee_id`, `week_starts_on`, `work_order`

#### Field Mappings:

| Workday Field    | Target Field      | Transformation Logic                              |
| ---------------- | ----------------- | ------------------------------------------------- |
| `employee_id`    | `user`            | Lookup in `sys_user` by `employee_number`         |
| `work_order`     | `project`         | Lookup in `pm_project` using custom field mapping |
| `project_number` | *(optional)*      | Used for validation or internal linking           |
| `week_starts_on` | `start_date`      | Date format MM-DD-YYYY; Always starts Saturday    |
| `expense_type`   | `u_expense_type`  | Mapped from account tag: Capital, Deferred, O\&M  |
| `time_blocks`    | `time_card_daily` | Used to generate daily entries after approval     |

#### onBefore Script Example:

```javascript
var userGR = new GlideRecord('sys_user');
userGR.addQuery('employee_number', source.employee_id);
userGR.query();
if (userGR.next()) {
  target.user = userGR.sys_id;
}

var projectGR = new GlideRecord('pm_project');
projectGR.addQuery('u_work_order', source.work_order);
projectGR.query();
if (projectGR.next()) {
  target.project = projectGR.sys_id;
}
```

---

## 5. API and Integration Details

### 5.1 Endpoint

* **Method:** POST
* **Endpoint:** `https://<instance>.service-now.com/api/now/import/imp_workday_timecards`
* **Auth:** OAuth 2.0 (Client Credentials Grant)

### 5.2 OAuth Setup

* **Token URL:** `https://<instance>.service-now.com/oauth_token.do`
* **Consumer Key / Secret:** Provided via SNOW OAuth Application Registry
* **Grant Type:** Client Credentials

### 5.3 Payload Structure (JSON Format)

```json
{
  "employee_id": "935460",
  "work_orders": [
    {
      "work_order": "NCSP250014831D",
      "project_number": "12345678",
      "week_starts_on": "2025-08-03",
      "expense_type": "O&M",
      "time_blocks": [
        { "date": "2025-08-03", "hours": 3 },
        { "date": "2025-08-05", "hours": 5 }
      ]
    },
    {
      "work_order": "NCSP250014831E",
      "project_number": "87654321",
      "week_starts_on": "2025-08-03",
      "expense_type": "Capital",
      "time_blocks": [
        { "date": "2025-08-04", "hours": 4 },
        { "date": "2025-08-06", "hours": 6 }
      ]
    }
  ]
}
```

---

## 6. Time Card Behavior Notes (Zurich Release)

* `time_card_daily` is **auto-created** upon **approval** of `time_card`
* `time_sheet` is created automatically if it does not exist
* Approval workflow is controlled by the assigned **Time Sheet Policy**

### Time Card State Lifecycle

* **Pending:** Default state after creation
* **Submitted:** User initiates approval process
* **Approved:** Manager or auto-approval policy
* **Processed:** Expense line created; ready for reporting
* **Rejected:** Returned by approver
* **Recalled:** Returned by submitter for modification

---

## 7. Security & Access Control

* OAuth 2.0 Client Credentials is required
* MuleSoft must store client ID/secret securely
* Integration user must have:

  * `import_transformer`, `soap`, and custom roles to write to `imp_workday_timecards`
  * Access to `pm_project`, `time_card`, and reference fields

---

## 8. Testing & Validation

### 8.1 Unit Testing

* Manual testing using Postman to simulate MuleSoft
* Validate transformation of JSON to time\_card
* Validate reference field lookups and coalesce behavior

### 8.2 Integration Testing

* MuleSoft sends payload to ServiceNow (DEV environment)
* Validate time card generation and daily records
* Check auditing and logging entries

### 8.3 Error Scenarios

| Scenario                       | Expected Result                    |
| ------------------------------ | ---------------------------------- |
| Missing employee\_id           | Rejected with error message        |
| Invalid work\_order            | Project lookup fails               |
| Duplicate time card (coalesce) | Record updated instead of inserted |
| Unauthorized token             | 401 Unauthorized                   |

---

## 9. Monitoring & Error Handling

* SNOW logs each API POST request via import set logs
* MuleSoft can be configured to retry on 5xx responses
* Errors will be logged in:

  * `syslog` table (optional custom table `u_timecard_log`)
* Optional alert to integration team via email

---

## 10. Environments & Deployment Strategy

| Environment | Usage       | Notes                                    |
| ----------- | ----------- | ---------------------------------------- |
| NICEHOST2   | Development | MuleSoft ↔ SNOW OAuth configured         |
| NICEHOST3   | Testing     | Reserved for end-to-end business testing |
| Production  | Go-live     | Credentials secured in CyberArk          |

---

## 11. Timeline and Sprint Plan

### Sprint Plan

| Sprint                  | Dates     | Scope                                                             |                          |            |                |
| ----------------------- | --------- | ----------------------------------------------------------------- | ------------------------ | ---------- | -------------- |
| Sprint 1                | Aug 12–16 | Core implementation, schema setup, OAuth config, internal testing |                          |            |                |
| Sprint 2                | Aug 19–23 | MuleSoft integration, logging, UAT support, documentation         | ------------------------ | ---------- | -------------- |
| Finalize schema/mapping | 2 days    | Rustam                                                            |                          |            |                |
| API Build + Testing     | 3 days    | Rustam                                                            |                          |            |                |
| OAuth config/test       | 2 days    | SNOW & MuleSoft                                                   |                          |            |                |
| Integration Test (QA)   | 3 days    | Combined                                                          |                          |            |                |
| Buffer / UAT feedback   | 2 days    | All                                                               |                          |            |                |

> 🎯 Target Start: Monday Aug 11, 2025
> 🧪 Target E2E Test-ready: Monday Aug 18, 2025

---

## 12. User Stories

| ID    | As a...              | I want to...                                                   | So that...                                                            | Est. (pts) |
| ----- | -------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- |
| US-01 | Developer            | Create a staging table (`imp_workday_timecards`)               | I can ingest Workday time entries via REST API                        | 2          |
| US-02 | Developer            | Configure a transform map from import set → `time_card`        | I can map Workday data into SNOW timecard records                     | 3          |
| US-03 | Developer            | Implement `onBefore` script to resolve user/project references | I can ensure foreign keys like `sys_user` and `pm_project` are linked | 3          |
| US-04 | Integration Engineer | Configure OAuth 2.0 with client credentials in SNOW            | MuleSoft can authenticate securely                                    | 3          |
| US-05 | Developer            | Expose import table as REST API endpoint                       | MuleSoft can push time entries via batch                              | 2          |
| US-06 | Developer            | Build error handling and logging for failed imports            | I can troubleshoot payload issues and alert support                   | 2          |
| US-07 | QA                   | Write test cases and validate timecard creation in DEV         | I can ensure records are transformed and created accurately           | 2          |
| US-08 | Team                 | Coordinate with MuleSoft to validate schema and auth           | I can receive and test real-time payloads                             | 1          |
| US-09 | Developer            | Document the API, mappings, and deployment steps               | Other teams can integrate and test successfully                       | 2          |

**Total Story Points: 20**

## 12. Appendix

* **Field Mapping Source:** `Data Field Mapping Workday to SNOW.xlsx`
* **Integration Pattern:** Weekly batch, JSON over REST
* **Security Approach:** OAuth 2.0 with client credentials
* **Functional SME:** Susie Gilliam

---

**Document Owner:** ServiceNow Delivery Team
**Last Updated:** August 7, 2025
