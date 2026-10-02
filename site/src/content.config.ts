import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // Sanskrit UI strings for the site chrome (search, theme picker, TOC…).
  // Without this, Starlight renders raw keys like `search.label`.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
