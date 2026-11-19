import { getRodCatalog } from '#server/utils/catalogs'

export default defineEventHandler(event => getRodCatalog(event))
