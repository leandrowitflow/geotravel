# Geotravel AI agent spec kit

This pack is split into small files so Cursor can read them reliably.

## Recommended reading order

1. `01_specify_product.md`
2. `02_specify_conversation_flows.md`
3. `03_specify_data_and_behaviour.md`
4. `04_specify_admin_center.md`
5. `05_plan_architecture_and_integrations.md`
6. `06_setup_checklists.md`
7. `07_tasks_mvp.md`
8. `08_guardrails_for_cursor.md`

## Frozen decisions

- This MVP is text only.
- No voice in this phase.
- Primary channel is WhatsApp.
- SMS is fallback only.
- The agent must enrich reservation data in the CRM.
- The agent must support multilingual conversations.
- The first message starts in English by default.
- The agent should switch to the customer language when confidence is high enough.
- The MVP is operational first, commercial second.
- Upsell and cross-sell must never block operational completion.
- Behavioural telemetry must be collected in a structured way from day one.
- The admin center is part of the MVP.
- The solution must visually align with the Geotravel website brand.

## Product intent

Build an AI agent integrated with the Geotravel CRM ecosystem so reservations can be enriched after booking, confirmed before service, and used to unlock controlled upsell and cross-sell opportunities.

The system must reduce operational gaps caused by incomplete reservation data from external channels such as Booking.com, where the transport provider may only receive a phone number and a rough passenger count. It must also create a foundation for future product learning by capturing structured behavioural signals from conversations.

## What this pack covers

- Product scope
- Conversation logic
- Data model
- Behavioural intelligence
- Admin center
- Technical architecture
- CRM and messaging integrations
- Meta WhatsApp and Twilio setup checklists
- MVP task breakdown
- Guardrails for Cursor

## What this pack does not cover

- Voice agent flows
- Final visual design system files
- Production legal copy
- Final pricing model
- Full BI dashboard implementation beyond MVP
- Full partner marketplace implementation

## Delivery principle

Cursor should implement this in controlled phases. It must not attempt to build every future idea at once. MVP means:

- reservation ingestion
- case creation
- WhatsApp outreach
- SMS fallback
- missing data collection
- CRM write-back
- D-1 confirmation
- consent capture
- admin center
- behavioural telemetry
- basic upsell and cross-sell triggers

Everything else is secondary.
