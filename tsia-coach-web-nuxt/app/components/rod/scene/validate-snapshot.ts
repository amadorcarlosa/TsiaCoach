import { materialRoles, type RodTrain, type ScenePolicy } from './rod.scene.types'
import { copyScene, type SceneSnapshot } from './scene-snapshot'
import { validateScene } from './rod-scene.placement'
import { isRodSign } from './rod-arithmetic'
export type SnapshotValidation = { allowed: true; trains: RodTrain[] } | { allowed: false; reason: string }
/** Pure replacement validation. Screen orientation/editability is checked only at commit. */
export function validateSnapshot(source: SceneSnapshot, policy: ScenePolicy): SnapshotValidation {
  const reject = (reason: string): SnapshotValidation => ({ allowed: false, reason })
  const candidate = copyScene(source)
  const ids = new Set<string>()

  for (const train of candidate) {
      if (!train.id.trim() || ids.has(train.id)) {
          return reject('Every train needs a unique, non-empty ID.')
      }
      ids.add(train.id)

      if (
          !Number.isInteger(train.anchor.x) ||
          !Number.isInteger(train.anchor.y)
      ) {
          return reject('Train anchors must use integer cells.')
      }

      if (train.parts.length === 0) {
          return reject('Every train needs at least one part.')
      }

      if (
          train.materialRole !== undefined &&
          !materialRoles.includes(train.materialRole)
      ) {
          return reject('Unknown material role.')
      }

      const groups = train.parts.map(part => part.addendGroup)
      if (groups.some(group => group !== undefined) && (
          groups.some(group => group !== 0 && group !== 1) ||
          !groups.includes(0) || !groups.includes(1) ||
          groups.some((group, index) => index > 0 && group! < groups[index - 1]!)
      )) {
          return reject('Addend groups must partition all parts into two ordered groups.')
      }

      for (const part of train.parts) {
          if (
              !Number.isInteger(part.value) ||
              part.value < 1 ||
              part.value > 10
          ) {
              return reject('Rod values must be integers from 1 to 10.')
          }

          if (part.sign !== undefined && !isRodSign(part.sign)) {
              return reject('Rod signs must be 1 or -1.')
          }

          if (part.sign === -1 && !policy.allowNegativeRods) {
              return reject(
                  'This board accepts positive rods only. Negative rods are available on the Array board.',
              )
          }

          if (
              !Number.isInteger(part.offset.x) ||
              !Number.isInteger(part.offset.y)
          ) {
              return reject('Part offsets must use integer cells.')
          }

          if (
              !['horizontal', 'vertical', 'tower']
                  .includes(part.orientation)
          ) {
              return reject('Unknown rod orientation.')
          }

          if (
              !policy.allowOrientation &&
              part.orientation !== 'horizontal'
          ) {
              return reject('This scene accepts horizontal rods only.')
          }
      }
  }

  const result = validateScene(candidate, policy)
  return result.allowed ? { allowed: true, trains: candidate } : result
}
