#!/bin/bash
# Скрипт для проверки конфигурации nginx для speq-bot

echo "=== Проверка конфигурации nginx для speq-bot ==="
echo ""

# Проверка синтаксиса nginx
echo "1. Проверка синтаксиса nginx:"
sudo nginx -t
echo ""

# Поиск location /speq-bot в конфигурации
echo "2. Поиск location /speq-bot в конфигурации:"
CONFIG_FILES=$(sudo find /etc/nginx -name "*.conf" -type f 2>/dev/null)
for file in $CONFIG_FILES; do
  if sudo grep -q "location /speq-bot" "$file" 2>/dev/null; then
    echo "Найдено в: $file"
    echo "Содержимое location блока:"
    sudo grep -A 20 "location /speq-bot" "$file" | head -25
    echo ""
    
    # Проверка наличия завершающего слеша
    if sudo grep -q "proxy_pass http://127.0.0.1:7504/;" "$file" 2>/dev/null; then
      echo "✅ proxy_pass настроен правильно (с завершающим слешем)"
    elif sudo grep -q "proxy_pass http://127.0.0.1:7504;" "$file" 2>/dev/null; then
      echo "❌ ОШИБКА: proxy_pass без завершающего слеша!"
      echo "   Нужно изменить: proxy_pass http://127.0.0.1:7504;"
      echo "   На: proxy_pass http://127.0.0.1:7504/;"
    else
      echo "⚠️  Не удалось найти proxy_pass для порта 7504"
    fi
    echo ""
  fi
done

# Проверка, слушает ли сервер на порту 7504
echo "3. Проверка порта 7504:"
if netstat -tlnp 2>/dev/null | grep -q ":7504" || ss -tlnp 2>/dev/null | grep -q ":7504"; then
  echo "✅ Порт 7504 слушается"
  netstat -tlnp 2>/dev/null | grep ":7504" || ss -tlnp 2>/dev/null | grep ":7504"
else
  echo "❌ Порт 7504 не слушается. Убедитесь, что сервер запущен."
fi
echo ""

# Тестовый запрос к локальному серверу
echo "4. Тестовый запрос к локальному серверу:"
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7504/health > /dev/null 2>&1; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7504/health)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Сервер отвечает на /health (код: $HTTP_CODE)"
  else
    echo "⚠️  Сервер отвечает, но код: $HTTP_CODE"
  fi
else
  echo "❌ Не удалось подключиться к серверу на порту 7504"
fi
echo ""

# Проверка webhook endpoint
echo "5. Тестовый запрос к webhook endpoint:"
if curl -s -X POST http://127.0.0.1:7504/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -o /dev/null -w "%{http_code}" > /dev/null 2>&1; then
  HTTP_CODE=$(curl -s -X POST http://127.0.0.1:7504/telegram/webhook \
    -H "Content-Type: application/json" \
    -d '{"test": true}' \
    -o /dev/null -w "%{http_code}")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "500" ]; then
    echo "✅ Webhook endpoint доступен (код: $HTTP_CODE)"
  else
    echo "⚠️  Webhook endpoint вернул код: $HTTP_CODE"
  fi
else
  echo "❌ Не удалось подключиться к webhook endpoint"
fi
echo ""

echo "=== Проверка завершена ==="
echo ""
echo "Если proxy_pass без завершающего слеша, обновите конфигурацию nginx:"
echo "  sudo nano /etc/nginx/sites-available/your-site"
echo "  # Измените: proxy_pass http://127.0.0.1:7504;"
echo "  # На: proxy_pass http://127.0.0.1:7504/;"
echo "  sudo nginx -t"
echo "  sudo systemctl reload nginx"
