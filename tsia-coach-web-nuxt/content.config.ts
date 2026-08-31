import { defineCollection, defineContentConfig } from '@nuxt/content'
import { z } from 'zod/v4'

const linkSchema = z.object({
  label: z.string(),
  to: z.string(),
  trailingIcon: z.string().optional(),
  color: z.enum(['neutral']).optional(),
  variant: z.enum(['outline']).optional(),
  size: z.enum(['lg', 'xl']).optional(),
})

const featureSchema = z.object({
  title: z.string(),
  description: z.string(),
})

export default defineContentConfig({
  collections: {
    index: defineCollection({
      type: 'page',
      source: 'index.yml',
      schema: z.object({
        hero: z.object({
          links: z.array(linkSchema),
        }),
        sections: z.array(z.object({
          id: z.string().optional(),
          title: z.string(),
          description: z.string(),
          orientation: z.enum(['horizontal', 'vertical']),
          reverse: z.boolean(),
          features: z.array(featureSchema),
        })),
        features: z.object({
          title: z.string(),
          description: z.string(),
          items: z.array(featureSchema),
        }),
        testimonials: z.object({
          headline: z.string(),
          title: z.string(),
          description: z.string(),
          items: z.array(z.object({
            quote: z.string(),
            user: z.object({
              name: z.string(),
              description: z.string().optional(),
              avatar: z.object({
                src: z.string(),
                alt: z.string().optional(),
              }).optional(),
            }),
          })),
        }),
        cta: z.object({
          title: z.string(),
          description: z.string(),
          links: z.array(linkSchema),
        }),
      }),
    }),
  },
})
