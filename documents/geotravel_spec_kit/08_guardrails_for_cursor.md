# Guardrails for Cursor

## Non-negotiable rules

1. Do not build voice functionality
2. Do not create an open chat assistant
3. Do not let upsell block operational completion
4. Do not ask for more data than needed
5. Do not tightly couple orchestration logic to one provider SDK
6. Do not store only transcripts without structured events
7. Do not skip manual intervention controls
8. Do not hardcode CRM field names without a mapping layer
9. Do not assume all reservations have valid WhatsApp delivery
10. Do not collapse operational consent and future marketing consent into one flag

## Implementation rules

- Use a clear state machine
- Keep modules small
- Prefer explicit services over hidden magic
- Add logging for all external calls
- Add idempotency for inbound reservation events
- Add retries only where safe
- Make statuses visible in the admin center

## UX rules

- operational clarity first
- no dashboard theatre
- no excessive charts in MVP
- case handling must be faster than the current manual process
- design should align with Geotravel branding

## AI rules

- extract to schema
- return confidence scores where relevant
- ask focused follow-up questions
- avoid hallucinating reservation facts
- if confidence is low, either ask again or route for review

## Messaging rules

- WhatsApp is primary
- SMS is fallback
- start in English
- switch language only when confidence is strong enough
- keep SMS copy shorter than WhatsApp copy
- respect quiet hours and attempt limits

## Data rules

- capture events, not just chat history
- separate operational fields from behavioural analytics
- separate consent types
- support deletion and retention policies later

## Delivery rules

- build in phases
- finish the backbone before advanced analytics
- finish operational flows before commercial flows
- do not rewrite working modules without reason
- document assumptions inside the code where needed

## Definition of failure

The implementation should be considered wrong if:
- it behaves like a generic chatbot
- it sends promotional content too early
- it cannot recover from CRM or messaging failures
- operators cannot understand case status
- behaviour data is not structured
- channel setup depends on manual hidden steps not documented in code or setup docs
