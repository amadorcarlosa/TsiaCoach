import { getBaseTenBlockCatalog } from '#server/utils/catalogs'

export default defineEventHandler(event => getBaseTenBlockCatalog(event))
