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

/* ---------------------------------------------------------------- /listings/mine */

/** A state of possibility: you have not posted yet, and posting is easy. */
export const MINE_EMPTY = {
  title: "Nothing posted yet",
  body: "Takes about a minute, and photos do most of the work.",
};

/* ------------------------------------------------------------------------ sign-in */

export const SIGNIN_HEADLINE = "Sign in";

/**
 * Says who the site is for before an account is picked, so a rejection is
 * never a surprise. The domain requirement itself is rendered separately,
 * from ALLOWED_DOMAIN_LABEL, so it cannot drift from the value the callback
 * actually enforces.
 */
export const SIGNIN_INTRO =
  "This is a marketplace for the GMI community, so sign-in is limited to institutional Google accounts.";

/* -------------------------------------------------------------------- /messages */

/**
 * A state of possibility. The second sentence is the product's argument again:
 * a message here is findable later, unlike one in a group chat.
 */
export const INBOX_EMPTY = {
  title: "No conversations yet",
  body: "When someone wants your stuff, it lands here — not buried under forty messages.",
};

/* --------------------------------------------------------------- the invite tile */

/**
 * Shown in the browse grid while the board is thin, in place of decorating
 * around the gap. The only thing that genuinely fixes a thin marketplace is
 * more listings, so the space asks for one.
 *
 * A state of possibility, so it gets the point of view — and the second
 * sentence is the product's argument again: a listing here outlives the
 * twenty minutes it would survive in a group chat.
 */
export const BOARD_INVITE = {
  title: "Got something to sell?",
  body: "Takes about a minute. It stays here until you take it down.",
};
