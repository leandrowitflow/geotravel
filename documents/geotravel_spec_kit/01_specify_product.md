# Specify, product

## Product name

Geotravel reservation enrichment agent

## Product summary

A text-first AI agent that contacts customers after a transfer booking, collects missing operational details, confirms the service before travel, writes structured results back to the CRM, and creates controlled opportunities for upsell and cross-sell.

## Problem

Reservation sources such as Booking.com and other intermediaries often provide incomplete data. This creates operational risk and lost revenue.

Typical gaps include:

- the real number of travelling passengers
- children and ages
- special luggage, for example golf equipment
- baby strollers or child seats
- reduced mobility needs
- other service notes that matter operationally

The current process is usually manual, slow, and inconsistent.

## Why this matters

Operationally:
- fewer service failures
- fewer no-shows caused by poor coordination
- fewer last-minute surprises for drivers and dispatch

Commercially:
- better data quality inside the CRM
- better ability to segment customers
- controlled opportunities to offer return transfers and partner services

Strategically:
- structured behavioural data can later improve prompts, flows, scoring, and commercial timing

## Product goals

### Primary goals

1. Enrich incomplete reservations with critical operational data
2. Confirm transfer readiness before the service date
3. Push structured data back into the CRM
4. Give the operator visibility and control through an admin center

### Secondary goals

5. Capture consent for future communication
6. Identify upsell and cross-sell opportunities
7. Capture behavioural telemetry for future optimisation

## Non-goals for this phase

- voice calls
- open-ended travel concierge behaviour
- fully autonomous sales agent behaviour
- deep recommendation engine
- direct payment and checkout flows
- full partner marketplace
- complex customer self-service portal rebuild

## Target users

### Direct business users

- transfer operations teams
- dispatch and booking staff
- admin users
- supervisors who need quality and consumption visibility

### End users

- travellers who booked a transfer through Booking.com or another channel
- travellers who need to confirm details by text
- travellers who may be eligible for relevant upsell or cross-sell suggestions

## Jobs to be done

### For the operator

- When a reservation arrives incomplete, help me collect the missing details automatically
- When service day approaches, help me confirm the reservation without manual chasing
- When the conversation finishes, write the useful results back into the CRM
- When something goes wrong, let my team see it and intervene quickly

### For the traveller

- Help me confirm and complete my reservation quickly
- Let me reply in my own language
- Avoid asking for irrelevant information
- Keep the conversation short and clear

## Success criteria

### Operational KPIs

- reservation enrichment completion rate
- D-1 confirmation completion rate
- percentage of reservations with critical fields completed
- percentage of cases needing human intervention
- average time from case creation to operational completion
- fallback to SMS rate
- opt-out rate

### Quality KPIs

- field extraction confidence
- correction rate after CRM write-back
- conversation completion rate by language
- conversation abandonment rate by step

### Commercial KPIs

- return transfer suggestion shown rate
- upsell acceptance rate
- cross-sell acceptance rate
- consent capture rate for future communication

### Behavioural learning KPIs

- first response latency
- average number of messages to completion
- drop-off by conversation step
- high-friction question list
- response quality by language and channel

## Scope in

- reservation-triggered case creation
- WhatsApp as primary outbound channel
- SMS fallback when WhatsApp fails or gets no response
- multilingual messaging
- structured missing-data collection
- D-1 confirmation flow
- CRM write-back
- opt-out handling
- consent capture
- admin center
- behavioural event collection
- controlled upsell and cross-sell rules

## Scope out

- voice
- email-first flows
- payments
- public booking engine
- deep partner inventory integration
- advanced machine learning training pipeline
- final BI warehouse

## Product principles

1. Operational first
2. Keep conversations short
3. Ask only what is necessary
4. Separate operational and commercial intents
5. Log behaviour as events, not only transcripts
6. Human override must always be possible
7. Brand tone must feel calm, useful, and reliable
