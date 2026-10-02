import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Deployment targets:
// - GitHub Pages (production site): defaults below, served at
//   https://svenkatreddy.github.io/Ramayana_Book/
// - Vercel (PR previews): set SITE_BASE=/ in the Vercel project settings.
//   SITE_URL then falls back to Vercel's own deployment URL automatically.
const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://svenkatreddy.github.io');
const siteBase = process.env.SITE_BASE ?? '/Ramayana_Book/';

// https://starlight.astro.build/reference/configuration/
export default defineConfig({
  site: siteUrl,
  base: siteBase,
  integrations: [
    starlight({
      title: 'रामायणम्',
      description:
        'The Rāmāyaṇa of Vālmīki — complete Sanskrit text of all seven kāṇḍas (645 sargas).',
      defaultLocale: 'root',
      locales: {
        root: { label: 'संस्कृतम्', lang: 'sa' },
      },
      customCss: ['./src/styles/custom.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/svenkatreddy/Ramayana_Book',
        },
      ],
      sidebar: [
        {
          label: 'बालकाण्डम् · Bala',
          collapsed: true,
          items: [{ autogenerate: { directory: 'bala_kanda' } }],
          },
        {
          label: 'अयोध्याकाण्डम् · Ayodhya',
          collapsed: true,
          items: [{ autogenerate: { directory: 'ayodhya_kanda' } }],
          },
        {
          label: 'अरण्यकाण्डम् · Aranya',
          collapsed: true,
          items: [{ autogenerate: { directory: 'aranya_kanda' } }],
          },
        {
          label: 'किष्किन्धाकाण्डम् · Kishkindha',
          collapsed: true,
          items: [{ autogenerate: { directory: 'kishkindha_kanda' } }],
          },
        {
          label: 'सुन्दरकाण्डम् · Sundara',
          collapsed: true,
          items: [{ autogenerate: { directory: 'sundara_kanda' } }],
          },
        {
          label: 'युद्धकाण्डम् · Yuddha',
          collapsed: true,
          items: [{ autogenerate: { directory: 'yuddha_kanda' } }],
          },
        {
          label: 'उत्तरकाण्डम् · Uttara',
          collapsed: true,
          items: [{ autogenerate: { directory: 'uttara_kanda' } }],
          },
      ],
      head: [
        {
          tag: 'meta',
          attrs: { name: 'theme-color', content: '#FDFBF6' },
        },
      ],
    }),
  ],
});
