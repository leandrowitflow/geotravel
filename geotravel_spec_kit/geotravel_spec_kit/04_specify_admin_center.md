# Specify, admin center

## Purpose

The admin center is the operational control layer for the business user.

It must help staff monitor, understand, and intervene.

## Primary user roles

### Admin

- full access
- settings
- templates
- channel configuration
- user management
- analytics access

### Operator

- case list
- case detail
- manual intervention
- CRM sync retry
- notes and status updates

### Supervisor

- quality view
- performance view
- exception review
- consumption and operational reporting

## MVP modules

### 1. Case inbox

Purpose:
- show all active and recent cases

Must include:
- case id
- reservation id
- customer name if available
- source channel
- current channel
- language
- case type
- enrichment status
- confirmation status
- consent status
- last activity time
- priority
- exception flag

### 2. Case detail view

Purpose:
- inspect one full case and intervene

Must include:
- reservation summary
- collected data
- missing fields
- full message timeline
- structured event timeline
- CRM sync history
- confidence and exception flags
- manual note area
- action buttons

Suggested actions:
- resend message
- force SMS fallback
- mark handled manually
- correct extracted field
- retry CRM write
- close case
- suppress future contact when valid

### 3. Quality and performance

Purpose:
- help the client understand system quality

Must include:
- completion rate
- D-1 confirmation rate
- fallback rate
- human intervention rate
- low-confidence extraction rate
- top drop-off steps
- performance by language
- performance by source

### 4. Consumption and cost view

Purpose:
- help the client understand usage and variable consumption

Must include:
- WhatsApp message counts
- SMS message counts
- estimated messaging cost
- token usage if exposed
- usage by period
- usage by source
- usage by language

### 5. Template and rules area

Purpose:
- allow controlled business-side adjustments

MVP can be simple, but should allow:
- viewing active templates
- turning selected flows on or off
- editing safe business copy fields later
- setting quiet hours
- setting retry windows

## Filtering requirements

The case inbox must support filters for:
- status
- channel
- language
- source
- date range
- priority
- needs intervention
- consent state

## Visual priorities

- clean and operational
- not over-designed
- Geotravel-aligned colours and feel
- mobile responsiveness is useful, but desktop-first is fine for MVP

## Notification ideas for MVP

Optional but useful:
- low-confidence extraction alerts
- CRM sync failure alerts
- D-1 cases not confirmed
- opt-out anomaly spike

## Auditability

Every manual action in the admin center must be logged with:
- action type
- user id
- timestamp
- before and after values when applicable
