export type RodLength = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export const rodPalette = {
  1: { name: 'White', fill: '#f4f4ef', ink: '#1c1c1c' },
  2: { name: 'Red', fill: '#d63c3c', ink: '#ffffff' },
  3: { name: 'Light green', fill: '#7bc95a', ink: '#10240c' },
  4: { name: 'Purple', fill: '#8e4fbf', ink: '#ffffff' },
  5: { name: 'Yellow', fill: '#f2c94c', ink: '#2a2200' },
  6: { name: 'Dark green', fill: '#2e8b57', ink: '#ffffff' },
  7: { name: 'Black', fill: '#242424', ink: '#ffffff' },
  8: { name: 'Brown', fill: '#8b5a2b', ink: '#ffffff' },
  9: { name: 'Blue', fill: '#2f6fd6', ink: '#ffffff' },
  10: { name: 'Orange', fill: '#f28c28', ink: '#1f1200' },
} satisfies Record<RodLength, { name: string, fill: string, ink: string }>
