/**
 * GET /api/scaffolds/:id
 *
 * Returns one authored scaffold definition.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A scaffold ID is required.',
    })
  }

  return await getScaffoldById(event, id)
})
