import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
if os.environ.get("ENV_FILE"):
    load_dotenv(os.environ["ENV_FILE"])
load_dotenv(BASE_DIR / ".env")

DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"
    else:
        raise ImproperlyConfigured("SECRET_KEY must be set in production")

DBTOOLS_SSO_SECRET = os.environ.get("DBTOOLS_SSO_SECRET")
if not DBTOOLS_SSO_SECRET:
    if DEBUG:
        DBTOOLS_SSO_SECRET = SECRET_KEY
    else:
        raise ImproperlyConfigured("DBTOOLS_SSO_SECRET must be set in production")
DBTOOLS_SSO_TTL_SECONDS = int(os.environ.get("DBTOOLS_SSO_TTL_SECONDS", "60"))
DBTOOLS_CREDENTIAL_KEY = os.environ.get("DBTOOLS_CREDENTIAL_KEY", "")
WEBMAIL_SSO_SECRET = os.environ.get("WEBMAIL_SSO_SECRET")
if not WEBMAIL_SSO_SECRET:
    if DEBUG:
        WEBMAIL_SSO_SECRET = DBTOOLS_SSO_SECRET
    else:
        raise ImproperlyConfigured("WEBMAIL_SSO_SECRET must be set in production")
WEBMAIL_SSO_TTL_SECONDS = int(os.environ.get("WEBMAIL_SSO_TTL_SECONDS", "60"))
WEBMAIL_SSO_URL = os.environ.get("WEBMAIL_SSO_URL", "")
INTERNAL_BILLING_API_TOKEN = os.environ.get("INTERNAL_BILLING_API_TOKEN", "")
BILLING_WEBHOOK_TOKEN = os.environ.get("BILLING_WEBHOOK_TOKEN", "")
BILLING_API_BASE = os.environ.get("BILLING_API_BASE", "https://panel.ehclouding.com/api/v1")
BILLING_API_TOKEN = os.environ.get("BILLING_API_TOKEN", "")

HOSTING_PROVISIONING_MODE = os.environ.get("HOSTING_PROVISIONING_MODE", "local").strip().lower()
HOSTING_DEFAULT_WEB_ENGINE = os.environ.get("HOSTING_DEFAULT_WEB_ENGINE", "openlitespeed").strip().lower()
LOCAL_PANEL_HOSTNAME = os.environ.get("LOCAL_PANEL_HOSTNAME", "")
LOCAL_PANEL_DATACENTER = os.environ.get("LOCAL_PANEL_DATACENTER", "")
LOCAL_PUBLIC_IP = os.environ.get("LOCAL_PUBLIC_IP", "")
LOCAL_PROVISIONING_HELPER = os.environ.get("LOCAL_PROVISIONING_HELPER", "/usr/local/sbin/ehpanel-local-provision")
LOCAL_PROVISIONING_DRY_RUN = os.environ.get("LOCAL_PROVISIONING_DRY_RUN", "false").lower() == "true"
LOCAL_PROVISIONING_SUDO = os.environ.get("LOCAL_PROVISIONING_SUDO", "true").lower() == "true"
LOCAL_HOME_ROOT = os.environ.get("LOCAL_HOME_ROOT", "/home")
LOCAL_NGINX_VHOSTS_DIR = os.environ.get("LOCAL_NGINX_VHOSTS_DIR", "/etc/nginx/conf.d")
LOCAL_OLS_HOME = os.environ.get("LOCAL_OLS_HOME", "/usr/local/lsws")
LOCAL_OLS_BACKEND_PORT = int(os.environ.get("LOCAL_OLS_BACKEND_PORT", "8088"))
LOCAL_PANEL_BACKEND = os.environ.get("LOCAL_PANEL_BACKEND", "http://127.0.0.1:8004")
LOCAL_PANEL_HOST_HEADER = os.environ.get("LOCAL_PANEL_HOST_HEADER", LOCAL_PANEL_HOSTNAME or "localhost")
LOCAL_PROVISION_DNS = os.environ.get("LOCAL_PROVISION_DNS", "true").lower() == "true"
LOCAL_PROVISION_SSL = os.environ.get("LOCAL_PROVISION_SSL", "true").lower() == "true"
LOCAL_PROVISION_MAIL = os.environ.get("LOCAL_PROVISION_MAIL", "true").lower() == "true"
LOCAL_WEBMAIL_ENABLED = os.environ.get("LOCAL_WEBMAIL_ENABLED", "true").lower() == "true"
LOCAL_WEBMAIL_ROOT = os.environ.get("LOCAL_WEBMAIL_ROOT", "/opt/ehpanel-webmail")
LOCAL_WEBMAIL_PORT = int(os.environ.get("LOCAL_WEBMAIL_PORT", "8012"))
LOCAL_DOVECOT_PASSWD_FILE = os.environ.get("LOCAL_DOVECOT_PASSWD_FILE", "/etc/dovecot/ehpanel-users")
LOCAL_POSTFIX_VIRTUAL_DOMAINS_FILE = os.environ.get("LOCAL_POSTFIX_VIRTUAL_DOMAINS_FILE", "/etc/postfix/ehpanel-virtual-domains")
LOCAL_POSTFIX_VIRTUAL_MAILBOXES_FILE = os.environ.get("LOCAL_POSTFIX_VIRTUAL_MAILBOXES_FILE", "/etc/postfix/ehpanel-virtual-mailboxes")
LOCAL_FILE_MANAGER_TEMP_ROOT = Path(os.environ.get("LOCAL_FILE_MANAGER_TEMP_ROOT", BASE_DIR / "media" / "file-manager"))

ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",")
    if o.strip()
]

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "agents",
    "hosting",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "ehpanel_web.middleware.ApiExceptionMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "ehpanel_web.urls"
ASGI_APPLICATION = "ehpanel_web.asgi.application"
WSGI_APPLICATION = "ehpanel_web.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
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

default_database = dj_database_url.config(
    default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    conn_max_age=60,
)
if default_database.get("ENGINE") == "django.db.backends.sqlite3":
    default_database.setdefault("OPTIONS", {})["timeout"] = int(os.environ.get("SQLITE_TIMEOUT_SECONDS", "20"))

DATABASES = {"default": default_database}

CHANNEL_LAYER_BACKEND = os.environ.get("CHANNEL_LAYER_BACKEND", "redis")
if CHANNEL_LAYER_BACKEND == "memory":
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
else:
    REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [REDIS_URL]},
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es"
TIME_ZONE = "America/La_Paz"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "media"))
SUPPORT_ATTACHMENT_MAX_SIZE = int(os.environ.get("SUPPORT_ATTACHMENT_MAX_SIZE", str(10 * 1024 * 1024)))
SUPPORT_ATTACHMENT_MAX_FILES = int(os.environ.get("SUPPORT_ATTACHMENT_MAX_FILES", "5"))
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAdminUser",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "hosting.authentication.ApiKeyAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("DRF_ANON_THROTTLE_RATE", "20/minute"),
        "login": os.environ.get("DRF_LOGIN_THROTTLE_RATE", "5/minute"),
        "user": os.environ.get("DRF_USER_THROTTLE_RATE", "120/minute"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.environ.get("JWT_ACCESS_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", "7"))),
}

AGENT_CLOCK_SKEW_SECONDS = int(os.environ.get("AGENT_CLOCK_SKEW_SECONDS", "90"))
AGENT_HEARTBEAT_TIMEOUT_SECONDS = int(os.environ.get("AGENT_HEARTBEAT_TIMEOUT_SECONDS", "45"))
AGENT_ALLOW_LEGACY_RESUME = os.environ.get("AGENT_ALLOW_LEGACY_RESUME", "false").lower() == "true"
TRUSTED_PROXY_IPS = [ip.strip() for ip in os.environ.get("TRUSTED_PROXY_IPS", "127.0.0.1,::1").split(",") if ip.strip()]

if os.environ.get("SECURE_PROXY_SSL_HEADER", "true").lower() == "true":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "false").lower() == "true"
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get("SECURE_HSTS_INCLUDE_SUBDOMAINS", "true").lower() == "true"
    SECURE_HSTS_PRELOAD = os.environ.get("SECURE_HSTS_PRELOAD", "true").lower() == "true"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

NODE_PUBLIC_IPS = {}
for item in os.environ.get("NODE_PUBLIC_IPS", "").split(","):
    if "=" not in item:
        continue
    hostname, ip_address = item.split("=", 1)
    hostname = hostname.strip()
    ip_address = ip_address.strip()
    if hostname and ip_address:
        NODE_PUBLIC_IPS[hostname] = ip_address
