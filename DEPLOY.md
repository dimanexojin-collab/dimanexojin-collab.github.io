# Деплой сайта «Контур»

## Перед публикацией
1. Заполнить `src/config/site.ts` (`npm run check:todo` покажет, что осталось). После замены `SITE.url`
   автоматически сменятся: canonical, `og:url`/`og:image`, JSON-LD (`@id`, `url`), `sitemap-*.xml`, `Host` и `Sitemap` в `robots.txt`.
   После заполнения города — title/description/H1 (`{в Городе}`), после телефона — description и шапка.
2. Сборка и проверки:
   ```bash
   STRICT=1 npm run build   # падает, если в обязательных полях остался TODO
   npm run audit            # SEO-аудит dist/: мета, ссылки, изображения, JSON-LD, sitemap/robots, бюджеты
   ```
3. Опубликовать содержимое `dist/`.

## Netlify / Cloudflare Pages
Build command `npm run build`, publish directory `dist`. Заголовки кеша и безопасности — в `public/_headers`
(копируется в `dist/_headers`): `/_astro/*` — `max-age=31536000, immutable`, иконки/OG — неделя, HTML — по умолчанию хостинга
(revalidate). Сжатие gzip/brotli оба хостинга включают сами. Страница 404 — `dist/404.html` подхватывается автоматически.

## nginx
Нужен модуль `ngx_brotli` (в большинстве сборок есть пакет `libnginx-mod-http-brotli`); без него оставьте только gzip.

```nginx
# http → https и www → без www (главное зеркало должно совпадать с SITE.url)
server {
    listen 80;
    listen [::]:80;
    server_name example.ru www.example.ru;
    return 301 https://example.ru$request_uri;
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name www.example.ru;
    # ssl_certificate ...;
    return 301 https://example.ru$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name example.ru;
    # ssl_certificate     /etc/letsencrypt/live/example.ru/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/example.ru/privkey.pem;

    root /var/www/kontur/dist;
    index index.html;
    charset utf-8;

    # --- сжатие ---
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 512;
    gzip_types text/plain text/css text/xml application/xml application/json application/manifest+json
               application/javascript text/javascript image/svg+xml image/x-icon;
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css text/xml application/xml application/json application/manifest+json
                 application/javascript text/javascript image/svg+xml image/x-icon;
    # если заранее сжимать dist (brotli/gzip -k), отдавать готовые файлы:
    # gzip_static on; brotli_static on;

    # --- заголовки безопасности ---
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # --- маршруты: все URL со слэшем (trailingSlash: 'always') ---
    location / {
        try_files $uri $uri/index.html =404;
        add_header Cache-Control "public, max-age=0, must-revalidate";
        # add_header внутри location отменяет унаследованные — повторяем
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        add_header X-Frame-Options SAMEORIGIN always;
    }
    # /uslugi → /uslugi/ (без слэша — 301 на канонический адрес)
    location ~ ^/(?<p>[^.]*[^/])$ {
        if (-d $document_root/$p) { return 301 /$p/$is_args$args; }
        try_files $uri =404;
    }

    # ассеты сборки с хешем — вечный кеш (^~ — чтобы regex-локации ниже не перехватили .avif/.webp/.woff2)
    location ^~ /_astro/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }
    location ~* \.(?:ico|png|svg|jpg|webp|avif)$ {
        add_header Cache-Control "public, max-age=604800";
    }
    location = /site.webmanifest {
        default_type application/manifest+json;
        add_header Cache-Control "public, max-age=86400";
    }
    location ~ ^/(robots\.txt|sitemap.*\.xml)$ {
        add_header Cache-Control "public, max-age=3600";
    }

    error_page 404 /404.html;
    location = /404.html { internal; }
}
```

## После деплоя
- Проверить заголовки: `curl -sI -H 'Accept-Encoding: br' https://example.ru/ | grep -i -E 'content-encoding|cache-control'`
  и `curl -sI https://example.ru/_astro/<файл>.woff2` (должно быть `immutable`).
- Lighthouse по проду: `npm run lighthouse -- https://example.ru`.
- Яндекс.Вебмастер и Google Search Console: подтвердить права (`SITE.analytics.*Verification`), отправить
  `https://example.ru/sitemap-index.xml`, в Вебмастере выбрать главное зеркало (директива `Host` устарела, нужен 301).
