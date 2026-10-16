// Dedicated, persistent messaging E2E fixtures (supabase/seed.sql), reloaded by every
// `supabase db reset`. A and B are pre-matched; C is deliberately unmatched with both,
// used to prove the not_participant UI boundary. Shared by the two message specs so the
// fixture identities/ids live in exactly one place.
export const MESSAGE_TEST_PASSWORD = "MessageTestPassw0rd!";

export const messageOwnerA = {
  email: "message-owner-a@doggo-date.test",
  password: MESSAGE_TEST_PASSWORD,
};

export const messageOwnerB = {
  email: "message-owner-b@doggo-date.test",
  password: MESSAGE_TEST_PASSWORD,
};

export const messageOwnerC = {
  email: "message-owner-c@doggo-date.test",
  password: MESSAGE_TEST_PASSWORD,
};

// Fixed match between A and B's dogs (supabase/seed.sql).
export const MATCH_AB_ID = "a0000000-0000-4000-8000-0000000000f1";
