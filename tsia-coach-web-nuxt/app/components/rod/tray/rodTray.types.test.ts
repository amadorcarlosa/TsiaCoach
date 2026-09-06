import { describe, it, expect } from 'vitest'
import { ariaRod, ariaTray } from './rodTray.types'

describe('tray accessibility wording', () => {
    it('names the tray and rod choices', () => {
        expect(ariaTray).toBe('Rod choices')
        expect(ariaRod('5')).toBe('Choose 5 rod')
    })
})
