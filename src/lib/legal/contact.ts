/** Public contact for legal pages — set NEXT_PUBLIC_LEGAL_CONTACT_EMAIL in production. */
export function legalContactEmail(): string {
  return (
    process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() ||
    "privacy@example.com (configure NEXT_PUBLIC_LEGAL_CONTACT_EMAIL)"
  );
}
