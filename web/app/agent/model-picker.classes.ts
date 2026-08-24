// app/agent/model-picker.classes.ts
export const modelPickerClasses = ['item', 'popup', 'indicator'] as const;
export const badgeSize = 16;

export const styleContract = {
    '.item': { display: 'flex' },
    '.item[data-highlighted]': {},   // must exist; its look is free to change
} as const;