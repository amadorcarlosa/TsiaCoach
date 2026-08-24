// app/agent/model-picker.styles.test.ts
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { modelPickerClasses, styleContract } from './model-picker.classes';

const css = readFileSync(
    new URL('./model-picker.module.css', import.meta.url),
    'utf8',
);

// convention: every rule is written as `selector {` with one space
function blockFor(selector: string): string {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) return '';
    const end = css.indexOf('}', start);
    return css.slice(start, end + 1);
}

describe('model-picker CSS contract', () => {
    for (const cls of modelPickerClasses) {
        test(`.${cls} has a base rule`, () => {
            expect(blockFor(`.${cls}`)).not.toBe('');
        });
    }

    for (const [selector, props] of Object.entries(styleContract)) {
        test(`${selector} is declared`, () => {
            expect(blockFor(selector)).not.toBe('');
        });

        for (const [prop, value] of Object.entries(props)) {
            test(`${selector} declares ${prop}: ${value}`, () => {
                expect(blockFor(selector)).toContain(`${prop}: ${value}`);
            });
        }
    }
});