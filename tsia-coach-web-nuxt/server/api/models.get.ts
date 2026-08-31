import { getModels } from '#server/utils/models'

/**
 * GET /api/models
 *
 * Returns the available AI model catalog used by the application.
 *
 * @param {import('h3').H3Event} event - Incoming H3 event carrying request headers/query context.
 * @returns {Promise<unknown>} Promise resolving with the model collection payload from
 *  `getModels`.
 * @throws {Error} Propagates errors raised by `getModels` when model resolution fails.
 */
export default defineEventHandler(async (event) => {
  return await getModels(event)
})
