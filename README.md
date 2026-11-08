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

## Реконструкция командного центра XD

Аудит и ограничения: [COMMAND_CENTER_AUDIT.md](docs/COMMAND_CENTER_AUDIT.md). Результаты проверки: [COMMAND_CENTER_VALIDATION.md](docs/COMMAND_CENTER_VALIDATION.md). Полное исходное ТЗ сохранено в [COMMAND_CENTER_REQUIREMENTS.md](docs/COMMAND_CENTER_REQUIREMENTS.md).

`npm run check` выполняет типизацию, тесты на временных SQLite-базах и production build. `python3 scripts/verify-command-center.py` после сборки запускает отдельный временный HTTP/Chromium-стенд (нужны Python Playwright и Chromium). Этот стенд не использует рабочую базу. Изменения не публикуются автоматически.
