/**
 * GET /api/scaffolds
 *
 * Returns authored scaffold definitions.
 */
export default defineEventHandler(async (event) => {
  return await getScaffolds(event)
})
