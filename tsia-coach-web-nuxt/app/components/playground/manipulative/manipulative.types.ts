export type ManipulativeResult = { allowed: true } | { allowed: false; reason: string }

/** One toolbar button / menu item, already checked against the current selection. */
export type ManipulativeChoice<Action> = {
  label: string
  action: Action
  result: ManipulativeResult
}
