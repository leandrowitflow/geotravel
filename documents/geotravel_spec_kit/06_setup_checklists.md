# Plan, setup checklists

## Goal

Make setup explicit so implementation is not blocked later by operational unknowns.

## Meta WhatsApp setup checklist

### Business prerequisites

- confirm the legal business entity that will own the WhatsApp presence
- confirm the business email used for Meta Business Manager
- confirm who will be the admin owner on the client side
- confirm the phone number intended for WhatsApp messaging
- confirm the number is not already in conflicting WhatsApp Business use

### Platform setup

- create or access Meta Business Manager
- verify the business in Meta if required
- create the app in Meta for WhatsApp integration
- connect the WhatsApp Business Account
- register the sender number
- configure webhook callback URL
- configure webhook verification token
- subscribe to the required webhook events
- generate system user access token or approved app credentials
- confirm message template approval flow
- prepare production templates in required languages

### Operational checklist

- define approved sender display name
- define message templates for:
  - welcome and reservation confirmation
  - missing data request
  - reservation update
  - cancellation acknowledgement
  - D-1 confirmation
  - consent request
  - return transfer suggestion
- test inbound and outbound message lifecycle
- test delivery status webhooks
- test quiet-hour rules

## Twilio SMS setup checklist

### Account setup

- create Twilio account
- verify billing configuration
- purchase or register SMS-capable sender where needed
- confirm countries to be supported
- confirm message compliance rules per target geography

### Platform setup

- generate account credentials
- configure messaging service
- configure status callback URL
- configure inbound webhook URL if replies will be handled
- define rate limits if needed
- confirm concatenated SMS handling for longer messages

### Operational checklist

- create SMS fallback templates
- create short re-engagement copy
- test failed WhatsApp to SMS fallback
- test delivery receipts
- test reply handling
- test suppression for opt-out contacts

## CRM setup checklist

- obtain API documentation
- obtain sandbox or test environment
- identify auth method
- identify webhook availability
- define reservation event payload
- define update payload for enrichment fields
- define cancellation event payload
- define rate limits
- define retry expectations
- confirm whether CRM stores conversation references

## AI layer setup checklist

- choose model provider for text orchestration
- define structured extraction schema
- define language detection approach
- define confidence scoring logic
- define moderation and safe-output rules
- define logging policy for prompts and outputs

## Internal readiness checklist

- define critical fields list
- define offer eligibility rules
- define quiet hours
- define escalation rules
- define admin roles
- define acceptance criteria for MVP go-live
