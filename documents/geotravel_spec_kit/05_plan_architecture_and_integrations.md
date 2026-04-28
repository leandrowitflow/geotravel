# Plan, architecture and integrations

## Recommended architecture

Text-first orchestration platform with provider abstraction.

## Main components

### 1. Reservation ingestion layer

Responsibilities:
- receive reservation events from CRM
- normalise source payloads
- create or update internal reservation records
- create cases based on business rules

### 2. Case orchestration engine

Responsibilities:
- decide next action per case
- manage conversation state
- manage retry logic
- manage fallback timing
- decide when upsell is allowed
- decide when human intervention is needed

### 3. Messaging adapters

MVP adapters:
- WhatsApp
- SMS

All messaging logic should use an internal provider abstraction so channel logic is not tightly coupled to one vendor SDK.

### 4. AI and extraction layer

Responsibilities:
- classify intent
- detect language
- extract structured fields
- summarise conversation state
- generate the next controlled message

### 5. CRM sync layer

Responsibilities:
- map internal fields to CRM fields
- write structured results back
- retry failed syncs
- log sync attempts and outcomes

### 6. Admin API and UI

Responsibilities:
- surface operations
- allow intervention
- surface quality and usage data

### 7. Event and analytics layer

Responsibilities:
- write structured behavioural events
- power operational reporting
- create clean data for later optimisation

## Suggested technical flow

1. CRM sends new reservation event
2. Reservation ingestion validates and stores it
3. Case orchestration creates enrichment case
4. WhatsApp message is sent
5. Customer replies
6. AI layer extracts structured information
7. Orchestrator decides next question or closes enrichment
8. CRM sync writes updated fields
9. D-1 scheduler creates or activates confirmation step
10. Behavioural events are recorded throughout

## CRM integration requirements

The CRM API contract must be defined before implementation begins.

Minimum needs:
- read reservation details
- receive new reservation events or poll changes
- receive reservation updates
- receive cancellations
- write enrichment fields back
- write confirmation status back
- write notes or metadata back if needed

### CRM safety requirements

- idempotent case creation
- idempotent write-back
- duplicate event handling
- partial update support
- conflict handling when humans changed the reservation
- retry with dead-letter handling for failed updates

## Messaging provider recommendation

### WhatsApp

Recommended for MVP:
- Meta WhatsApp Business Platform via Cloud API

Reason:
- direct product ownership path
- stronger long-term platform fit
- easier alignment with a branded client setup

### SMS

Recommended for MVP:
- Twilio SMS

Reason:
- mature API
- reliable fallback path
- clear consumption visibility

## Provider abstraction requirement

Even if the first implementation uses Meta for WhatsApp and Twilio for SMS, build a channel abstraction with:
- send_message
- receive_webhook
- delivery_status
- message_template_lookup
- message_cost_metadata

This avoids future lock-in.

## Scheduler requirements

Need scheduled jobs for:
- retry windows
- D-1 confirmation
- stale-case checks
- CRM retry queue
- optional reminder timing

## Environment variables

Suggested configuration groups:
- CRM API
- Meta WhatsApp
- Twilio SMS
- AI model settings
- scheduling settings
- feature flags
- analytics settings
- admin authentication settings

## Failure handling

Must explicitly handle:
- invalid phone number
- unsupported country format
- no WhatsApp delivery
- no customer response
- low extraction confidence
- CRM update failure
- duplicate reservation event
- cancellation during active case

## Observability

Must capture:
- message send status
- webhook events
- CRM sync results
- scheduler execution logs
- model errors
- extraction confidence failures

## Security and privacy baseline

- secure secrets storage
- admin authentication
- role-based access control
- audit logs
- configurable retention
- export and deletion workflows to be supported later

## Branding requirement

The admin center must visually align with the current Geotravel site brand.
Do not invent a disconnected design language.
