# Tasks, MVP delivery plan

## Phase 0, foundations

### Task 0.1
Define the CRM field map and event contract.

DoD:
- source fields documented
- target fields documented
- create, update, cancel event payloads documented
- write-back contract documented

### Task 0.2
Define conversation state machine.

DoD:
- states documented
- transitions documented
- retry rules documented
- terminal states documented

### Task 0.3
Define multilingual and extraction schema.

DoD:
- supported languages listed
- extraction fields listed
- confidence rules listed

## Phase 1, reservation and case backbone

### Task 1.1
Create reservation ingestion module.

DoD:
- accepts new reservation payload
- stores normalised reservation
- prevents duplicates

### Task 1.2
Create case entity and orchestration seed.

DoD:
- creates enrichment case from new reservation
- attaches reservation reference
- initial status visible in admin API

### Task 1.3
Create behavioural event writer.

DoD:
- writes structured events
- supports core event payload
- works across reservation and messaging flow

## Phase 2, messaging channels

### Task 2.1
Implement WhatsApp adapter.

DoD:
- sends template message
- receives webhook updates
- stores delivery status
- stores replies

### Task 2.2
Implement SMS adapter.

DoD:
- sends fallback SMS
- receives delivery status
- receives replies if enabled
- stores message metadata

### Task 2.3
Implement provider abstraction.

DoD:
- business logic uses internal messaging interface
- channel switching works without duplicated orchestration logic

## Phase 3, AI flow

### Task 3.1
Implement language detection.

DoD:
- detects supported language from reply
- stores confidence
- supports fallback logic

### Task 3.2
Implement structured extraction.

DoD:
- extracts critical fields
- returns confidence by field
- stores extracted payload

### Task 3.3
Implement controlled reply generator.

DoD:
- next step chosen from state machine
- no open-ended drift
- asks only one clear thing at a time

## Phase 4, CRM write-back

### Task 4.1
Write enrichment results back to CRM.

DoD:
- critical fields map correctly
- retries supported
- failure states logged

### Task 4.2
Write D-1 confirmation state back to CRM.

DoD:
- confirmed and unconfirmed outcomes supported
- updated timestamps stored

## Phase 5, admin center

### Task 5.1
Build case inbox.

DoD:
- list view works
- filters work
- status badges visible

### Task 5.2
Build case detail view.

DoD:
- reservation summary visible
- collected data visible
- message timeline visible
- event timeline visible
- manual actions available

### Task 5.3
Build quality and consumption views.

DoD:
- core KPIs visible
- channel counts visible
- date filters work

## Phase 6, scheduler and operational flows

### Task 6.1
Implement retry scheduler.

DoD:
- retry timing works
- quiet hours respected
- max attempts enforced

### Task 6.2
Implement D-1 confirmation scheduler.

DoD:
- creates or activates D-1 step
- sends correct message
- updates case state

## Phase 7, controlled commercial layer

### Task 7.1
Implement eligibility rules.

DoD:
- return transfer signal supported
- special-luggage or family signals supported
- no commercial trigger before operational completion

### Task 7.2
Implement consent capture.

DoD:
- operational and future communication states separated
- consent recorded clearly

## Phase 8, QA and hardening

### Task 8.1
Test multilingual flows.

DoD:
- English, Portuguese, Spanish, French, and German tested
- fallback behaviour tested

### Task 8.2
Test edge cases.

DoD:
- invalid phone
- no reply
- duplicate event
- cancellation during active case
- low-confidence extraction
- CRM write failure

### Task 8.3
Prepare MVP release checklist.

DoD:
- env vars documented
- templates approved
- channel credentials configured
- dashboards reviewed
