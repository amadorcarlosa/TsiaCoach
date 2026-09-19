export const playgroundTabs = [
  { id: 'baseTenPlayground', label: 'Base ten' },
  { id: 'algebraTilePlayground', label: 'Algebra tiles' },
  { id: 'barModelPlayground', label: 'Bar Rod Playground' },
  { id: 'arrayModelPlayground', label: 'Array Rod Playground' },
  {
    id: 'fractionModelPlayground',
    label: 'Fraction Rod Playground',
  },
  { id: 'mathTablaPlayground', label: 'MathTabla Playground' },
] as const

export type PlaygroundId = typeof playgroundTabs[number]['id']
