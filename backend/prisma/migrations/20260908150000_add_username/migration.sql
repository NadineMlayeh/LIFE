-- The public handle. Unique and changeable; email stays login-only so nobody has to hand out
-- their address to be findable.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "usernameLower" TEXT;

-- Existing accounts are seeded from the local part of their email, sanitised to the allowed
-- character set and de-duplicated. They can change it afterwards like anyone else.
WITH base AS (
  SELECT id, regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_]', '_', 'g') AS raw
  FROM "User"
),
sized AS (
  SELECT id, CASE WHEN length(raw) < 3 THEN raw || '_user' ELSE left(raw, 24) END AS candidate
  FROM base
),
numbered AS (
  SELECT id, candidate, row_number() OVER (PARTITION BY candidate ORDER BY id) AS rn
  FROM sized
)
UPDATE "User" u
SET "username"      = CASE WHEN n.rn = 1 THEN n.candidate ELSE n.candidate || n.rn::text END,
    "usernameLower" = lower(CASE WHEN n.rn = 1 THEN n.candidate ELSE n.candidate || n.rn::text END)
FROM numbered n
WHERE u.id = n.id;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "usernameLower" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_usernameLower_key" ON "User"("usernameLower");
