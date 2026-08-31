/**
 * GET /api/sample-items/:id
 *
 * Returns a single sample practice item.
 */
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'A sample item ID is required.',
        })
    }

    return await getSampleItemById(event, id)
})