import { getAlgebraTileCatalog } from '#server/utils/catalogs'

export default defineEventHandler(event => getAlgebraTileCatalog(event))
