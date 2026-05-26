from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404, JsonResponse
from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter

from ehpanel_web.auth_views import EHPanelTokenRefreshView, EHPanelTokenView, MeView
from ehpanel_web.user_views import AccessSecurityViewSet, AccessSessionViewSet, GroupViewSet, PermissionViewSet, UserViewSet
from agents.views import ops_dashboard
from hosting.views import AuditLogViewSet, MailAutoconfigView, MailAutodiscoverView, MailMobileconfigView


def health(_request):
    return JsonResponse({"status": "ok"})


def frontend_asset(_request, asset_path):
    dist_dir = settings.BASE_DIR / "frontend" / "dist"
    target = (dist_dir / asset_path).resolve()
    if not str(target).startswith(str(dist_dir.resolve())) or not target.is_file():
        raise Http404("Asset not found")
    return FileResponse(target.open("rb"))


def frontend_app(_request):
    index_path = settings.BASE_DIR / "frontend" / "dist" / "index.html"
    if not index_path.is_file():
        raise Http404("Frontend build not found")
    return FileResponse(index_path.open("rb"), content_type="text/html")


router = DefaultRouter()
router.register("audit", AuditLogViewSet, basename="audit")
router.register("users", UserViewSet, basename="users")
router.register("roles", GroupViewSet, basename="roles")
router.register("permissions", PermissionViewSet, basename="permissions")
router.register("access-sessions", AccessSessionViewSet, basename="access-sessions")
router.register("access-security", AccessSecurityViewSet, basename="access-security")


urlpatterns = [
    path("health/", health),
    path("ops/", ops_dashboard),
    path("django-admin/", admin.site.urls),
    path("api/auth/token/", EHPanelTokenView.as_view()),
    path("api/auth/refresh/", EHPanelTokenRefreshView.as_view()),
    path("api/auth/me/", MeView.as_view()),
    path("api/", include(router.urls)),
    path("api/agents/", include("agents.urls")),
    path("api/integrations/billing/", include("hosting.billing_urls")),
    path("api/v1/billing/", include("hosting.billing_urls")),
    path("api/billing/", include("hosting.billing_urls")),
    path("api/", include("hosting.app_urls")),
    path("api/hosting/", include("hosting.urls")),
    path(".well-known/autoconfig/mail/config-v1.1.xml", MailAutoconfigView.as_view()),
    path("mail/config-v1.1.xml", MailAutoconfigView.as_view()),
    path("mail/mobileconfig/", MailMobileconfigView.as_view()),
    path("autodiscover/autodiscover.xml", MailAutodiscoverView.as_view()),
    re_path(r"^(?P<asset_path>assets/.+)$", frontend_asset),
    re_path(r"^(?!api/|django-admin/|health/|ops/).*", frontend_app),
]
