This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## English edition and offline translation

The English edition is available under `/en`. Albanian posts remain the source posts in WordPress. Translations are saved as separate WordPress posts and receive a `Momenti English translation` tag, so they are kept out of Albanian lists and feeds. Editorial tags also place them in the matching English sections. Automatic browser-language redirects stay disabled until `ENGLISH_EDITION_READY=true` is set after the archive has been translated.

Translation runs on the server with Argos Translate and its locally installed Albanian-to-English model. Article text is not sent to an external translation service. The model package must be downloaded once during server setup; after installation, translation is offline.

### Server setup

1. Install Python 3 on the VPS and install the local translation package:

   ```sh
   python3 -m pip install -r requirements-translation.txt
   python3 scripts/install-argos-sq-en.py
   ```

2. In WordPress, create a dedicated user with permission to publish posts, then create an Application Password from **Users → Profile → Application Passwords**. Store the username and application password in the VPS environment. Do not put these values in Git or send them in chat.

3. Set these server environment variables:

   ```text
   WORDPRESS_URL=https://cms.momenti.info
   WP_TRANSLATION_USERNAME=dedicated-wordpress-user
   WP_TRANSLATION_APP_PASSWORD=wordpress-application-password
   ARTICLE_TRANSLATION_SECRET=long-random-secret
   ARGOS_PYTHON=/usr/bin/python3
   ```

4. Restart the Next.js process after adding the variables. To backfill the archive, run this from the VPS with `SITE_URL` and `ARTICLE_TRANSLATION_SECRET` available in its environment:

   ```sh
   SITE_URL=https://momenti.info npm run translation:archive
   ```

   It processes up to three articles per request, oldest first, and stops at the end of the untranslated archive. It can be restarted safely; already translated articles are skipped.

5. Schedule the recent mode on the VPS so new posts are translated shortly after publication. For example, add a five-minute cron entry using the same protected environment:

   ```cron
   */5 * * * * . /etc/momenti-translation.env && cd /path/to/momenti-2.0 && SITE_URL=https://momenti.info npm run translation:recent >> /var/log/momenti-translation.log 2>&1
   ```

The protected trigger is `POST /api/translations/process` with a bearer token matching `ARTICLE_TRANSLATION_SECRET`. It accepts `{ "mode": "archive" }` or `{ "mode": "recent" }` and processes a maximum of five posts per request.

Machine translation can misstate names or details. Review important articles before relying on the English text for editorial decisions or AdSense approval; translation alone does not guarantee approval.
