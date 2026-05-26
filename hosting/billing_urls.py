from django.urls import path
from rest_framework.routers import DefaultRouter

from .billing_integration import (
    BillingAuthCheckView,
    BillingHealthView,
    BillingHostingAccountViewSet,
    BillingNodeSummaryView,
    BillingPlansActiveView,
    BillingServiceChangePasswordView,
    BillingServiceChangePlanView,
    BillingServiceDetailView,
    BillingServiceProvisionView,
    BillingServiceStatusView,
    BillingServiceSuspendView,
    BillingServiceTerminateView,
    BillingServiceUnsuspendView,
    BillingServiceUsageView,
)


router = DefaultRouter()
router.register("hosting-accounts", BillingHostingAccountViewSet, basename="billing-hosting-accounts")

urlpatterns = [
    path("auth/check/", BillingAuthCheckView.as_view(), name="billing-auth-check"),
    path("health/", BillingHealthView.as_view(), name="billing-integration-health"),
    path("node/summary/", BillingNodeSummaryView.as_view(), name="billing-node-summary"),
    path("telemetry/", BillingNodeSummaryView.as_view(), name="billing-telemetry"),
    path("plans/active/", BillingPlansActiveView.as_view(), name="billing-plans-active"),
    path("services/provision/", BillingServiceProvisionView.as_view(), name="billing-service-provision"),
    path("services/<str:external_service_id>/", BillingServiceDetailView.as_view(), name="billing-service-detail"),
    path("services/<str:external_service_id>/status/", BillingServiceStatusView.as_view(), name="billing-service-status"),
    path("services/<str:external_service_id>/suspend/", BillingServiceSuspendView.as_view(), name="billing-service-suspend"),
    path("services/<str:external_service_id>/unsuspend/", BillingServiceUnsuspendView.as_view(), name="billing-service-unsuspend"),
    path("services/<str:external_service_id>/terminate/", BillingServiceTerminateView.as_view(), name="billing-service-terminate"),
    path("services/<str:external_service_id>/change-password/", BillingServiceChangePasswordView.as_view(), name="billing-service-change-password"),
    path("services/<str:external_service_id>/change-plan/", BillingServiceChangePlanView.as_view(), name="billing-service-change-plan"),
    path("services/<str:external_service_id>/usage/", BillingServiceUsageView.as_view(), name="billing-service-usage"),
    *router.urls,
]
