/**
 * GET /api/sample-items
 *
 * Returns all available sample practice items.
 */
export default defineEventHandler(async (event) => {
    return await getSampleItems(event)
})