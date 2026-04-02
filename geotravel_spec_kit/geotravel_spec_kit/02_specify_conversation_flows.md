# Specify, conversation flows

## Core rule

This is not an open chat assistant.

It is a goal-driven messaging agent with ordered objectives.

## Ordered objectives

1. Identify the reservation context
2. Confirm the customer is the correct contact
3. Collect missing critical data
4. Confirm the upcoming service
5. Capture communication consent for future use
6. Only then evaluate upsell and cross-sell opportunities

## Channel strategy

### WhatsApp

Primary channel for the full conversation.

Use for:
- initial outreach
- missing-data collection
- D-1 confirmation
- controlled commercial suggestions

### SMS

Fallback channel only.

Use for:
- short re-engagement
- missed WhatsApp cases
- final operational prompt when WhatsApp is unavailable or silent

SMS messages must be shorter and more direct than WhatsApp.

## Language strategy

- First outbound message starts in English by default
- The system detects customer language from the reply
- If confidence is high enough, the conversation switches to the detected language
- If confidence is low, ask a short clarifying question or continue in English
- MVP priority languages:
  - English
  - Portuguese
  - Spanish
  - French
  - German
- Other languages may use controlled fallback to English

## Required operational data

The uploaded Geotravel communication material indicates these missing-data needs very clearly. The MVP must support them natively.

### Critical operational fields

- actual passenger count
- number of children
- child ages
- special luggage
- special luggage type
- reduced mobility needs
- reduced mobility notes
- additional operational notes

### Suggested luggage examples

- golf equipment
- sports equipment
- baby stroller
- wheelchair
- oversized luggage

## Reservation lifecycle flows

### Flow A, post-booking enrichment

Trigger:
- new reservation received from CRM or intermediary source

Goal:
- collect missing operational fields and store them in the CRM

Suggested steps:
1. send welcome and reservation confirmation
2. confirm customer identity or relationship to the booking
3. collect missing critical fields only
4. summarise the captured data
5. ask for confirmation
6. write results to CRM
7. mark case as operationally completed or partially completed

### Flow B, reservation update

Trigger:
- reservation changed in CRM

Goal:
- notify the traveller and, when needed, re-collect affected information

Suggested steps:
1. notify that reservation details changed
2. present what changed
3. ask if the previous collected data is still valid
4. re-open only the relevant data fields
5. update CRM

### Flow C, cancellation

Trigger:
- reservation cancelled in CRM or by customer

Goal:
- confirm cancellation and optionally collect reason

Suggested steps:
1. confirm cancellation
2. if appropriate, request cancellation reason
3. map reason to a controlled reason taxonomy
4. store the cancellation reason in CRM or analytics layer

### Flow D, D-1 confirmation

Trigger:
- reservation is one day away

Goal:
- confirm the service and reduce last-minute operational risk

Suggested steps:
1. remind the traveller about the reservation
2. ask for confirmation
3. ask whether any critical detail changed
4. update CRM if anything changed
5. mark confirmation status

## Consent flow

Consent must be separated by communication type.

### Operational messages

Operational messages can continue while needed for reservation fulfilment.

### Future commercial messages

Ask separately for permission to receive:
- future travel suggestions
- return transfer reminders
- related partner offers

Consent should never be hidden inside the operational copy.

## Upsell and cross-sell rules

Upsell and cross-sell must be controlled.

### Allowed after operational completion

- return transfer suggestion
- suitable vehicle or service upgrade
- selected local partner offer when context makes sense

### Not allowed

- long promotional sequences before critical fields are completed
- irrelevant offers
- aggressive sales behaviour
- multiple offers in the same first operational interaction

## Tone and copy rules

- short and clear
- no jargon
- warm but not overly casual
- no fake human deception
- no pressure language
- no long paragraphs
- each question should have one clear purpose

## Example conversation states

- case_created
- outbound_sent
- customer_replied
- language_detected
- missing_fields_requested
- missing_fields_partially_completed
- missing_fields_completed
- crm_updated
- d1_confirmation_pending
- d1_confirmed
- consent_requested
- consent_granted
- upsell_eligible
- upsell_shown
- upsell_accepted
- closed
