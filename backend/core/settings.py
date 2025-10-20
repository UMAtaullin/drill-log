import os
from pathlib import Path
import time


BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-er!n7baj$6%*i2l+gqu9sid1p)lvp4kubvh!1p=#=mo83-x+tc'

DEBUG = False

ALLOWED_HOSTS = ['Ural207.pythonanywhere.com']


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Сторонние приложения
    "rest_framework",
    "corsheaders",
    # Наше приложение
    "drilling_log",
]


MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",  # Временно!
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
}

# CORS настройки для мобильного доступа
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://192.168.1.100:8000",  # Ваш IP
    "http://0.0.0.0:8000",
]

CORS_ALLOW_ALL_ORIGINS = True  # Временно для тестирования

# CORS_ALLOW_CREDENTIALS = True

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "drilling_log/templates",  # Папка с шаблонами
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


LANGUAGE_CODE = 'ru-ru'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

# Добавляем STATIC_ROOT
STATIC_URL = f"/static/?v={int(time.time())}"
STATIC_ROOT = BASE_DIR / "staticfiles"  # Папка для collectstatic

# STATICFILES_DIRS для разработки
STATICFILES_DIRS = [
    BASE_DIR / "static",  # Ваши статические файлы
]


# Для PWA
# Настройки для PWA
CORS_ALLOWED_ORIGINS = [
    "https://Ural207.pythonanywhere.com",
]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
