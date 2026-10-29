# =============================================================================
# مكتبة المرئيات — صورتان من ملف واحد:
#   --target app     الخادم (Next.js standalone) — لا أدوات وسائط فيه
#   --target worker  العامل: ffmpeg (libx264 + libsvtav1 + aac) وexiftool وLibRaw وخط DejaVu للعلامة المائية
# كلاهما بمستخدم غير root، وبلا أي سرّ: الأسرار تأتي بيئةً من /opt/sites/media/.env على الخادم.
# البناء من جذر library/:  docker build -f deploy/vps/Dockerfile --target app .
# =============================================================================

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# الخادم، ثم العامل وسكربتات التشغيل (الترحيل، أول مدير، إعداد الدلو) مجمّعةً بـ esbuild
RUN pnpm build && pnpm build:ops

# ── الخادم ───────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Hebron
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ── العامل ───────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS worker
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends ffmpeg libimage-exiftool-perl libraw-bin fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && enc="$(ffmpeg -hide_banner -encoders 2>/dev/null)" \
 && for e in libx264 libsvtav1 aac; do \
      echo "$enc" | awk -v e="$e" '$2 == e { f = 1 } END { exit !f }' || { echo "ffmpeg without encoder $e" >&2; exit 1; }; \
    done
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Hebron WORKER_HEALTH_PORT=3191
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
# العامل، ومعه سكربتات التشغيل: الترحيل (drizzle + graphile_worker)، وأول مدير، وسياسة CORS للدلو
COPY --from=build --chown=node:node /app/dist/ops ./ops
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/deploy/vps/r2-cors.json ./deploy/vps/r2-cors.json
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3191/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "ops/worker.mjs"]
