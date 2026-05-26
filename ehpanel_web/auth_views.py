from django.conf import settings
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def serialize_user(user):
    groups = {name.lower() for name in user.groups.values_list("name", flat=True)}
    role = (
        "admin"
        if user.is_superuser
        else "reseller"
        if "reseller" in groups or user.reseller_accounts.exists() or hasattr(user, "hosting_reseller_profile") or hasattr(user, "reseller_team_membership")
        else "moderator"
        if "moderador" in groups
        else "technician"
        if user.is_staff
        else "client"
    )
    return {
        "id": user.id,
        "username": user.get_username(),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": role,
        "is_staff": user.is_staff,
        "is_active": user.is_active,
    }

def request_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    remote_addr = request.META.get("REMOTE_ADDR") or None
    if forwarded_for and remote_addr in getattr(settings, "TRUSTED_PROXY_IPS", []):
        return forwarded_for.split(",")[0].strip() or None
    return remote_addr


def record_access_session(user, request, refresh=None):
    if not request:
        return
    from hosting.models import AccessSession

    serialized = serialize_user(user)
    user_agent = request.META.get("HTTP_USER_AGENT", "")[:1000]
    device = user_agent[:180] or "N/D"
    refresh_jti = ""
    if refresh is not None:
        refresh_jti = str(refresh.get("jti", "") or "")
    AccessSession.objects.create(
        user=user,
        ip_address=request_ip(request),
        user_agent=user_agent,
        device=device,
        role=serialized["role"],
        status=AccessSession.Status.ACTIVE,
        refresh_jti=refresh_jti,
        last_seen_at=timezone.now(),
    )


class EHPanelTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = serialize_user(self.user)
        refresh = RefreshToken(data["refresh"])
        record_access_session(self.user, self.context.get("request"), refresh)
        return data


class EHPanelTokenView(TokenObtainPairView):
    serializer_class = EHPanelTokenSerializer
    throttle_scope = "login"


class EHPanelTokenRefreshView(TokenRefreshView):
    throttle_scope = "login"


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(serialize_user(request.user))


def token_response_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": serialize_user(user),
    }
