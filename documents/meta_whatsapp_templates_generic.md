# Generic Meta WhatsApp message templates (Geotravel)

Use these as **starting copy** when you create templates in [WhatsApp Manager](https://business.facebook.com/) → **Account tools** → **Message templates**. Meta must **approve** each template before production sends.

**Categories:** all three are framed as **utility** (account updates / service confirmations / follow-up). If Meta rejects wording, soften sales language and avoid promotional hooks.

**Language:** create at least **English (`en_US`)**. Add **Portuguese (`pt_PT`)** as a separate template language on the same template if you message PT customers.

**Variables:** Meta body variables are `{{1}}`, `{{2}}`, … in order. This app’s sender (`src/lib/messaging/meta-whatsapp.ts`) maps `templateVariables` with **`Object.values(...)`**, so preserve the **same key insertion order** as the parameter order below (or pass an array-shaped payload if you change the sender later).

---

## 1. Welcome

| Field | Suggested value |
|--------|------------------|
| **Template name** | `geotravel_welcome_generic` |
| **Category** | Utility |
| **Header** | None (or optional text header without variables) |

**Body (English)**

```text
Hello {{1}}, welcome to Geotravel. Thank you for reaching out. We're here to help with your transfer — if you have any questions, just reply to this message.
```

| Param | Meaning | Example |
|-------|---------|---------|
| `{{1}}` | Customer first name or neutral greeting token | `Maria` or `there` |

**Example `templateVariables` (order matters):**

```ts
{ customer_name: "Maria" }
```

**Body (Portuguese — optional second language on same template)**

```text
Olá, {{1}}, bem-vindo(a) à Geotravel. Obrigado pelo contacto. Estamos aqui para ajudar com o seu transfer — se tiver dúvidas, responda a esta mensagem.
```

---

## 2. We have confirmed

| Field | Suggested value |
|--------|------------------|
| **Template name** | `geotravel_booking_confirmed_generic` |
| **Category** | Utility |

**Body (English)**

```text
Hi {{1}}, Geotravel has confirmed your booking {{2}}. Summary: {{3}}. If anything is incorrect, reply here and we'll correct it.
```

| Param | Meaning | Example |
|-------|---------|---------|
| `{{1}}` | Customer name | `João` |
| `{{2}}` | Booking reference / ID | `BK-900017` |
| `{{3}}` | One-line human-readable summary (pickup/time/route) | `Lisbon airport → Hotel, 15 Jun 10:00` |

**Example `templateVariables`:**

```ts
{
  customer_name: "João",
  booking_ref: "BK-900017",
  summary: "Lisbon airport → Hotel, 15 Jun 10:00",
}
```

**Body (Portuguese — optional)**

```text
Olá, {{1}}, a Geotravel confirmou a sua reserva {{2}}. Resumo: {{3}}. Se algo estiver incorreto, responda aqui e corrigimos.
```

---

## 3. After transfer (thank you & how was the service)

Use **after the transfer is completed** — thanks them for choosing Geotravel and invites quick feedback on how the service went (they reply in-thread).

| Field | Suggested value |
|--------|------------------|
| **Template name** | `geotravel_post_transfer_followup` (or keep an older slug if already submitted) |
| **Category** | Utility |

**Body (English)**

```text
Hi {{1}}, thank you for choosing Geotravel for your transfer. We hope everything went well for you. How was the service? We'd really appreciate your feedback — just reply to this message.
```

| Param | Meaning | Example |
|-------|---------|---------|
| `{{1}}` | Customer name | `Ana` |

**Example `templateVariables`:**

```ts
{ customer_name: "Ana" }
```

**Body (Portuguese — optional)**

```text
Olá, {{1}}, obrigado por confiar na Geotravel para o seu transfer. Esperamos que tudo tenha corrido bem. Como foi o serviço? A sua opinião é muito importante para nós — responda a esta mensagem quando puder.
```

---

## Quick reference: template names → variable order

| Template name | Ordered values |
|---------------|----------------|
| `geotravel_welcome_generic` | customer name |
| `geotravel_booking_confirmed_generic` | customer name → booking ref → summary line |
| `geotravel_post_transfer_followup` | customer name |

Rename the **template name** in Meta if your WABA already uses these slugs; keep names **lowercase with underscores** to match typical Cloud API usage.

## Notes

- **24-hour session:** templates are for **starting** or **re-opening** conversations outside the customer service window; after the user replies, you can use session messages where policy allows.
- **Pilot / custom copy:** Geotravel-specific confirmation text built in-app (e.g. `buildGeotravelWhatsAppConfirmationMessage`) is separate from these **generic Meta templates** — use templates when you need Meta-approved shells and fill variables from your backend.
