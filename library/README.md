# مكتبة المرئيات — EMDATRA

موقع مستقل لتسليم الصور والفيديو للجهات المستفيدة، على `media.emdatra.org`. الخطة في `docs/plan.md`، والتصميم في `docs/design/`.

> هذا المجلد مستقل عن «ميديا برو» (تطبيق PHP في جذر المستودع): له قاعدته وحاويته ونطاقه.

## التشغيل محليًا

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres + Meilisearch + MinIO
cp .env.example .env.local                        # واملأ القيم المحلية
pnpm install
pnpm db:migrate
pnpm dev
```

- مكوّنات الواجهة: `http://localhost:3000/dev/components` (في التطوير فقط).
- الفحص: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`.

## القواعد

- `dir` و`lang` من الخادم، وخصائص CSS منطقية فقط، والخطوط مجمّعة في `public/fonts` (لا طلبات خارجية).
- الألوان من `src/styles/tokens.css` وحدها.
- لا أسرار في Git: كل مفتاح من البيئة، و`.env.example` بالأسماء فقط.
