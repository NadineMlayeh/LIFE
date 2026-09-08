-- A letter may carry an invitation to the sender's room. Deliberately not a foreign key: if
-- the share link is revoked later, the letter survives and only the door stops opening.
ALTER TABLE "Letter" ADD COLUMN "shareToken" TEXT;
