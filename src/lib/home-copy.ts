/**
 * The home page's marketing copy.
 *
 * Kept here rather than inline in JSX for the same reason
 * `AFFILIATION_DISCLAIMER` is in `legal.ts`: these strings have rules
 * attached — no shouting, personality only in states of possibility, jokes
 * about the impossible rather than the prohibited — and a rule with no test
 * beside it is an aspiration.
 *
 * The voice belongs to someone who got tired of listings being buried in the
 * GMI WhatsApp and Telegram groups and built somewhere for them to live.
 */

export const HOME_HEADLINE = "Buy, sell and rent around GMI.";

/** The product's entire argument, in six words. */
export const HOME_TAGLINE = "Without it buried in a group chat.";

/**
 * Two real items, then one impossible one. Real first so it reads as a hint
 * rather than a gag, and short so the joke survives truncation on a phone.
 * Deliberately absurd rather than illicit — a joke about a banned item would
 * undercut the Acceptable Use Policy.
 */
export const SEARCH_PLACEHOLDER = "Books, clown nose, time machine…";

/** A state of possibility, so it gets the point of view. */
export const EMPTY_NOTHING_POSTED = {
  title: "Nothing posted yet",
  body: "Be first — it will still be here next week, which is more than the group chat can manage.",
};

/** A state of friction. Plain and useful; nobody wants wit here. */
export const EMPTY_NO_MATCHES = {
  title: "No matches",
  body: "Nothing matches those filters yet. Try a broader category, or clear the search.",
};
