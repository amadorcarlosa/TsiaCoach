

export const Manipulatives ={
    BaseTenBlocks:'base-ten-blocks',
    CuisenaireRods:'cuisenaire-rods',
    Triangles:'triangles',
    AlgebraTiles:'algebra-tiles',
}as const 
export type Manipulative = (typeof Manipulatives)[keyof typeof Manipulatives];
// 'base-ten-blocks' | 'cuisenaire-rods' | 'triangles' | 'algebra-tiles'
