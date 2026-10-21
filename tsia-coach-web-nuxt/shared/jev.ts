export type JevResult = {
  action: 'observe' | 'ask' | 'hint' | 'demonstrate'
  confidence: number | null
  probabilities: Record<string, number> | null
  model: string
  usage: { input_tokens?: number, output_tokens?: number, inputTokens?: number, outputTokens?: number, cost?: number } | null
  raw: unknown
  request: unknown
}
