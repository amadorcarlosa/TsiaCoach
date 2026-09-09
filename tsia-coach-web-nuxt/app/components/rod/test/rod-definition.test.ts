import { describe, it, expect } from 'vitest';
import { RodDefinitionSchema } from '#server/schemas/rod-definition';
import {CuisenaireRodColors} from "~/components/rod/rod.types.ts";


describe('RodDefinitionSchema', () => {
    const validRod = {
        length: 1,
        color: 'white' as const,
        poses: [{
            orientation: 'horizontal' as const,
            dimensions: { width: 1, depth: 1, height: 1 },
        }],
    };

    it('should validate a complete valid rod', () => {
        const result = RodDefinitionSchema.safeParse(validRod);
        expect(result.success).toBe(true);
    });

    describe('color field', () => {
        it('should reject unknown color', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                color: 'neon',
            });
            expect(result.success).toBe(false);
        });

        it('should accept all valid colors', () => {
            Object.values(CuisenaireRodColors).forEach(color => {
                const result = RodDefinitionSchema.safeParse({
                    ...validRod,
                    color,
                });
                expect(result.success).toBe(true);
            });
        });

        it('should reject missing color', () => {
            const { color, ...rest } = validRod;
            const result = RodDefinitionSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });
    });

    describe('length field', () => {
        it('should accept number length', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                length: 5,
            });
            expect(result.success).toBe(true);
        });

        it('should accept string length', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                length: '5',
            });
            expect(result.success).toBe(true);
        });

        it('should reject missing length', () => {
            const { length, ...rest } = validRod;
            const result = RodDefinitionSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });
    });

    describe('poses array', () => {
        it('should accept empty poses array', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                poses: [],
            });
            expect(result.success).toBe(true);
        });

        it('should accept multiple poses', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                poses: [
                    {
                        orientation: 'horizontal' as const,
                        dimensions: { width: 1, depth: 1, height: 1 },
                    },
                    {
                        orientation: 'vertical' as const,
                        dimensions: { width: 1, depth: 1, height: 1 },
                    },
                ],
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid orientation', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                poses: [{
                    orientation: 'diagonal',
                    dimensions: { width: 1, depth: 1, height: 1 },
                }],
            });
            expect(result.success).toBe(false);
        });

        it('should reject missing orientation', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                poses: [{
                    dimensions: { width: 1, depth: 1, height: 1 },
                }],
            });
            expect(result.success).toBe(false);
        });
    });

    describe('dimensions object', () => {
        it('should accept number dimensions', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                poses: [{
                    orientation: 'horizontal' as const,
                    dimensions: { width: 2, depth: 1, height: 1 },
                }],
            });
            expect(result.success).toBe(true);
        });

        it('should accept string dimensions', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                poses: [{
                    orientation: 'horizontal' as const,
                    dimensions: { width: '2', depth: '1', height: '1' },
                }],
            });
            expect(result.success).toBe(true);
        });

        it('should reject missing width', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                poses: [{
                    orientation: 'horizontal' as const,
                    dimensions: { depth: 1, height: 1 },
                }],
            });
            expect(result.success).toBe(false);
        });

        it('should reject missing depth', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                poses: [{
                    orientation: 'horizontal' as const,
                    dimensions: { width: 1, height: 1 },
                }],
            });
            expect(result.success).toBe(false);
        });

        it('should reject missing height', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                poses: [{
                    orientation: 'horizontal' as const,
                    dimensions: { width: 1, depth: 1 },
                }],
            });
            expect(result.success).toBe(false);
        });
    });

    describe('orientations', () => {
        it('should accept all valid orientations', () => {
            const orientations = ['horizontal', 'vertical', 'tower'] as const;

            orientations.forEach(orientation => {
                const result = RodDefinitionSchema.safeParse({
                    ...validRod,
                    poses: [{
                        orientation,
                        dimensions: { width: 1, depth: 1, height: 1 },
                    }],
                });
                expect(result.success).toBe(true);
            });
        });

        it('should reject invalid orientation', () => {
            const result = RodDefinitionSchema.safeParse({
                ...validRod,
                poses: [{
                    orientation: 'diagonal',
                    dimensions: { width: 1, depth: 1, height: 1 },
                }],
            });
            expect(result.success).toBe(false);
        });
    });
});
