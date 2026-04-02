# Specify, data and behaviour

## Design principle

Do not store unstructured conversation history only.

Store both transcript data and structured event data.

## Core entities

### Reservation

Represents the source booking record.

Suggested fields:
- reservation_id
- external_source
- external_booking_id
- pickup_datetime
- pickup_location
- dropoff_location
- booking_status
- source_phone
- source_email
- source_language_hint
- last_synced_at

### Case

Represents the operational AI workflow around a reservation.

Suggested fields:
- case_id
- reservation_id
- case_type
- case_status
- enrichment_status
- confirmation_status
- consent_status
- priority
- assigned_to
- created_at
- updated_at
- closed_at

### Contact

Represents the traveller or the active contact.

Suggested fields:
- contact_id
- reservation_id
- phone
- email
- preferred_language
- detected_language
- confidence_language
- relationship_to_booking
- do_not_contact

### Collected data

Represents structured enrichment results.

Suggested fields:
- passenger_count_actual
- children_count
- child_ages
- special_luggage_present
- special_luggage_types
- reduced_mobility_present
- reduced_mobility_notes
- baby_stroller_present
- child_seat_needed
- additional_notes
- collection_confidence
- last_confirmed_at

### Consent

Suggested fields:
- consent_operational_basis
- consent_future_marketing
- consent_return_transfer_reminders
- consent_partner_offers
- consent_captured_at
- consent_source

### Offer signal

Represents commercial eligibility.

Suggested fields:
- return_transfer_missing
- return_transfer_eligible
- upgrade_eligible
- partner_offer_eligible
- offer_reason_codes
- offer_shown
- offer_accepted

## Behavioural telemetry

This is mandatory from day one.

### Why

The system must learn from customer behaviour over time, but that learning must start from structured observation.

### Event model

Each important action must create an event.

Suggested events:
- case_created
- reservation_synced
- outbound_message_sent
- outbound_message_delivered
- outbound_message_read
- customer_replied
- language_detected
- field_requested
- field_completed
- field_refused
- extraction_low_confidence
- crm_write_attempted
- crm_write_succeeded
- crm_write_failed
- fallback_sms_triggered
- d1_confirmation_requested
- d1_confirmed
- d1_not_confirmed
- consent_requested
- consent_granted
- consent_declined
- offer_eligibility_detected
- offer_shown
- offer_clicked
- offer_accepted
- opt_out_requested
- human_intervention_requested
- case_closed

### Event payload guidance

Every event should include:
- event_id
- case_id
- reservation_id
- channel
- language
- event_type
- event_timestamp
- step_name
- actor_type
- confidence_score when relevant
- metadata object

## Behavioural metrics

### Conversation metrics

- time to first reply
- average messages per completed case
- completion rate by language
- completion rate by source
- drop-off point by step
- fallback rate by source and language

### Field metrics

- fields most often missing
- fields most often completed
- fields most often refused
- extraction confidence per field
- correction frequency after write-back

### Quality metrics

- cases reopened after closure
- cases escalated to humans
- opt-out frequency
- customer sentiment flag, if later implemented

### Commercial metrics

- offer eligibility rate
- offer show rate
- offer acceptance rate
- consent rate by offer type

## Training and optimisation strategy

### Phase 1

Use behavioural events to improve:
- prompts
- flow order
- fallback timing
- copy clarity
- language handling
- offer timing

### Phase 2

Create a cleaned dataset for future model optimisation.

This dataset must not simply be all transcripts. It should be curated from:
- successful cases
- failed cases with clear reasons
- edge cases
- multilingual cases
- corrected extraction examples

## Data governance principles

- collect only what is necessary
- distinguish operational data from learning data
- keep raw transcript retention separate from event retention
- keep consent records explicit
- do not profile for commercial use without clear purpose and control

## Suggested retention logic

This should remain configurable, but the architecture must support:

- transcript retention policy
- event retention policy
- audit retention policy
- deletion and anonymisation workflows
