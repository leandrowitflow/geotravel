/** Only destination for Infobip smoke / agent test sends (PT pilot line). */
export const SMS_TEST_TO_DIGITS = "351966915976";

export function smsTestToE164(): string {
  return `+${SMS_TEST_TO_DIGITS}`;
}
