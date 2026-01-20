# Конфигурация развертывания для SPA

Это приложение использует React Router для маршрутизации на стороне клиента. Для корректной работы всех маршрутов (включая `/courier/:slug`) необходимо настроить сервер так, чтобы все запросы возвращали `index.html`.

## Netlify

Файл `public/_redirects` уже настроен автоматически.

## Vercel

Файл `vercel.json` уже настроен в корне проекта.

## Nginx

Используйте следующую конфигурацию в вашем `nginx.conf`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Apache

Создайте файл `.htaccess` в папке `dist`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## Docker с Nginx

Пример `Dockerfile`:

```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Важно

После обновления конфигурации сервера:
1. Перезагрузите/перезапустите веб-сервер
2. Очистите кеш браузера (Ctrl+Shift+R или Cmd+Shift+R)
3. Проверьте, что маршрут `/courier/sichov-oleksiy` работает корректно
