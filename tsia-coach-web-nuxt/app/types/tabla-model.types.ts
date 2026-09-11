export const TablaModels = {
  BarModel: 'bar-model',
  TapeDiagram: 'tape-diagram',
  ArrayModel: 'array-model',
  BoxModel: 'box-model',
} as const

export type TablaModel = (typeof TablaModels)[keyof typeof TablaModels]
