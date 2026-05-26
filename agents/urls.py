from rest_framework.routers import DefaultRouter

from .views import AgentEventViewSet, AgentJobViewSet, EnrollmentTokenViewSet, MailQueueViewSet, NodeViewSet

router = DefaultRouter()
router.register("nodes", NodeViewSet, basename="nodes")
router.register("enrollment-tokens", EnrollmentTokenViewSet, basename="enrollment-tokens")
router.register("events", AgentEventViewSet, basename="events")
router.register("jobs", AgentJobViewSet, basename="jobs")
router.register("mail-queue", MailQueueViewSet, basename="mail-queue")

urlpatterns = router.urls
