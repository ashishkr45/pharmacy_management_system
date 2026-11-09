/**
 * True when `error` is a Prisma unique-constraint violation (P2002).
 *
 * Do **not** use `instanceof Prisma.PrismaClientKnownRequestError` here:
 * Prisma 7 with the `@prisma/adapter-pg` driver adapter throws an error object
 * whose prototype does not always match the generated class, so `instanceof`
 * returns false and a duplicate would leak as a 500. The `code` property is
 * stable across both paths.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
