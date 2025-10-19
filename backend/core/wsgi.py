import os
import sys

# Добавляем путь к проекту
path = "/home/uma/drill-log/backend"  # замените uma на ваш username
if path not in sys.path:
    sys.path.append(path)

# Указываем настройки Django
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"

# Загружаем приложение
from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
