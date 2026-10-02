import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://starlight.astro.build/reference/configuration/
export default defineConfig({
  site: 'https://svenkatreddy.github.io',
  base: '/Ramayana_Book/',
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
