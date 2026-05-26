from rest_framework.routers import DefaultRouter

from .views import HostingApplicationViewSet

router = DefaultRouter()
router.register("apps", HostingApplicationViewSet, basename="apps")

urlpatterns = router.urls
