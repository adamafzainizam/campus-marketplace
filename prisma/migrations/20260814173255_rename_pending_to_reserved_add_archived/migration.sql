-- Rename in place rather than dropping and recreating the enum: RENAME VALUE
-- preserves every existing row, where a drop/recreate would require rewriting
-- the column and would fail on any row still holding the old value.
ALTER TYPE "ListingStatus" RENAME VALUE 'PENDING' TO 'RESERVED';

-- Withdrawn by the seller. Deleting a listing is deliberately blocked once it
-- has conversations (Conversation -> Listing is onDelete: Restrict), so this
-- is how a seller retires one without destroying message history.
ALTER TYPE "ListingStatus" ADD VALUE 'ARCHIVED';
