-- Supplier names must be unique (decision #22/#24): two suppliers with the same
-- name would be indistinguishable in purchase and report screens.
DROP INDEX "suppliers_name_idx";

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");
