# تشغيل الاختبارات محليًا

```bash
pg_ctlcluster 16 main start     # أو: docker compose -f docker-compose.dev.yml up -d postgres
python3 -m venv .venv-s3 && .venv-s3/bin/pip install "moto[server]==5.1.20"
.venv-s3/bin/moto_server -H 127.0.0.1 -p 9000 &   # بديل R2 (أو MinIO من docker-compose.dev.yml)
DATABASE_URL=postgres://media:media@localhost/media_test pnpm db:migrate
pnpm lint && pnpm typecheck && pnpm test && pnpm build
apt-get install ffmpeg libimage-exiftool-perl libraw-bin libheif-examples libheif-plugin-libde265   # أدوات العامل (اختبارات M4)
pnpm test:e2e                                     # يُنشئ الدلو ويضبط CORS كما في R2، ويشغّل العامل بجانب الخادم
E2E_BIG_UPLOAD=1 pnpm exec playwright test upload.spec -g survives   # قبول M3 بملف 2 GiB
```

الاختبارات تستعمل قيمًا خاصة بها (`tests/e2e/env.ts`) لا تُستعمل في غيرها.
