export const playgroundTabs = [
  { id: 'barModelPlayground', label: 'Bar Rod Playground' },
  { id: 'arrayModelPlayground', label: 'Array Rod Playground' },
] as const

export type PlaygroundId = typeof playgroundTabs[number]['id']
