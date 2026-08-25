'use client';
import styles from './model-picker.module.css';
import { Select } from '@base-ui/react/select';
import type { components } from '@/lib/api/schema';
import { badgeSize } from './model-picker.classes';

type VendorName = components['schemas']['VendorName'];

const vendorIcons: Record<VendorName, string> = {
    anthropic: '/provider-icons/anthropic-claude-symbol-250.webp',
    openAI: '/provider-icons/openai-blossom-white.svg',
    deepSeek: '/provider-icons/deepseek.svg',
};

export type ModelOption = {
    value: string;
    label: string;
    vendor: VendorName;
};



// after: "give me the list, the current choice, and a phone number to report changes"
type ModelPickerProps = {
    models: ModelOption[];
    value: string;
    onValueChange: (value: string) => void;
};

export function ModelPicker({ models, value, onValueChange }: ModelPickerProps) {
    return (
        <Select.Root
            items={models}
            value={value}
            onValueChange={(v) => {
                if (v !== null) onValueChange(v);
            }}
        >
            <Select.Trigger>
                <Select.Value />
                <Select.Icon>▾</Select.Icon>
            </Select.Trigger>

            <Select.Portal>
                <Select.Positioner sideOffset={6}>
                    <Select.Popup className={styles.popup}>
                        {models.map((m) => (
                            <Select.Item key={m.value} value={m.value} className={styles.item}>
                                <img src="/provider-icons/azure-ai-foundry.svg" alt="" width={badgeSize} height={badgeSize} />
                                <img src={vendorIcons[m.vendor]} alt="" width={badgeSize} height={badgeSize} />
                                <Select.ItemText>{m.label}</Select.ItemText>
                                <Select.ItemIndicator className={styles.indicator}>✓</Select.ItemIndicator>
                            </Select.Item>
                        ))}
                    </Select.Popup>
                </Select.Positioner>
            </Select.Portal>
        </Select.Root>
    );
}