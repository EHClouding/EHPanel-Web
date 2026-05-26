from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.db.models import Q
from django.utils import timezone
from rest_framework import pagination, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from ehpanel_web.auth_views import serialize_user, token_response_for_user
from hosting.models import AccessSession, AuditLog, GlobalConfiguration


User = get_user_model()


class UserPagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    reseller = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    company = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_staff",
            "is_active",
            "date_joined",
            "reseller",
            "company",
            "phone",
        ]
        read_only_fields = ["id", "role", "is_staff", "date_joined", "company", "phone"]

    def get_role(self, user):
        return serialize_user(user)["role"]

    def get_company(self, _user):
        return None

    def get_phone(self, _user):
        return None


class CreateUserSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=["admin", "moderator", "technician", "reseller", "client"])
    password = serializers.CharField(write_only=True, min_length=8)
    reseller = serializers.IntegerField(required=False, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    company = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "first_name", "last_name", "role", "password", "reseller", "phone", "company"]

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este username.")
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este email.")
        return value

    def create(self, validated_data):
        role = validated_data.pop("role")
        validated_data.pop("reseller", None)
        validated_data.pop("phone", None)
        validated_data.pop("company", None)
        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)
        apply_role(user, role)
        user.save()
        sync_role_groups(user, role)
        return user


class UpdateUserSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=["admin", "moderator", "technician", "reseller", "client"], required=False)
    reseller = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "role", "is_active", "reseller"]

    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        validated_data.pop("reseller", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if role:
            apply_role(instance, role)
        instance.save()
        if role:
            sync_role_groups(instance, role)
        return instance


class ResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(min_length=8)


class GroupSerializer(serializers.ModelSerializer):
    users_count = serializers.SerializerMethodField()
    permission_ids = serializers.PrimaryKeyRelatedField(source="permissions", queryset=Permission.objects.all(), many=True, required=False)
    permissions_detail = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ["id", "name", "description", "users_count", "permission_ids", "permissions_detail", "status"]

    def get_permissions_detail(self, group):
        return [{"id": permission.id, "codename": permission.codename, "name": permission.name} for permission in group.permissions.all()]

    def get_description(self, group):
        defaults = {
            "Administrador": "Acceso completo excepto eliminacion definitiva",
            "Moderador": "Gestion operativa sin configuraciones criticas",
            "Contabilidad": "Facturacion, reportes y clientes comerciales",
            "Soporte tecnico": "Soporte, tickets, correo, backups y diagnostico",
        }
        return defaults.get(group.name, "Rol interno de EHPanel")

    def get_status(self, _group):
        return "active"

    def get_users_count(self, group):
        return group.user_set.count()


class PermissionSerializer(serializers.ModelSerializer):
    app = serializers.CharField(source="content_type.app_label", read_only=True)
    model = serializers.CharField(source="content_type.model", read_only=True)
    groups_enabled = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ["id", "name", "codename", "app", "model", "groups_enabled"]

    def get_groups_enabled(self, permission):
        return list(permission.group_set.values_list("name", flat=True))


class AccessSessionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.get_username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = AccessSession
        fields = ["id", "user", "username", "email", "ip_address", "location", "device", "role", "status", "status_label", "last_seen_at", "closed_at", "created_at"]


class AccessSecuritySerializer(serializers.Serializer):
    require_2fa_staff = serializers.BooleanField(default=False)
    admin_ip_allowlist = serializers.ListField(child=serializers.CharField(), required=False)
    failed_login_limit = serializers.IntegerField(default=5, min_value=1, max_value=50)
    failed_login_window_minutes = serializers.IntegerField(default=10, min_value=1, max_value=1440)
    session_timeout_hours = serializers.IntegerField(default=8, min_value=1, max_value=168)
    alert_new_device = serializers.BooleanField(default=True)
    critical_actions_owner_only = serializers.BooleanField(default=True)


def apply_role(user, role):
    user.is_superuser = role == "admin"
    user.is_staff = role in {"admin", "moderator", "technician"}


def sync_role_groups(user, role):
    reseller_group, _ = Group.objects.get_or_create(name="reseller")
    staff_groups = {
        "admin": "Administrador",
        "moderator": "Moderador",
        "technician": "Soporte tecnico",
    }
    managed_groups = [reseller_group]
    for group_name in staff_groups.values():
        group, _ = Group.objects.get_or_create(name=group_name)
        managed_groups.append(group)
    user.groups.remove(*managed_groups)
    if role == "reseller":
        user.groups.add(reseller_group)
    elif role in staff_groups:
        group, _ = Group.objects.get_or_create(name=staff_groups[role])
        user.groups.add(group)


def ensure_default_staff_groups():
    for name in ["Administrador", "Moderador", "Contabilidad", "Soporte tecnico"]:
        Group.objects.get_or_create(name=name)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("username")
    permission_classes = [IsAdminUser]
    pagination_class = UserPagination

    def get_serializer_class(self):
        if self.action == "create":
            return CreateUserSerializer
        if self.action in {"update", "partial_update"}:
            return UpdateUserSerializer
        return UserSerializer

    def get_queryset(self):
        ensure_default_staff_groups()
        queryset = super().get_queryset().prefetch_related("groups")
        role = self.request.query_params.get("role")
        search = self.request.query_params.get("search")

        if role == "admin":
            queryset = queryset.filter(is_superuser=True)
        elif role == "reseller":
            queryset = queryset.filter(groups__name__iexact="reseller")
        elif role == "technician":
            queryset = queryset.filter(is_staff=True, is_superuser=False).exclude(groups__name__iexact="reseller")
        elif role == "client":
            queryset = queryset.filter(is_staff=False, is_superuser=False).exclude(groups__name__iexact="reseller")

        if search:
            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        return queryset.distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="impersonate")
    def impersonate(self, request, pk=None):
        target = self.get_object()
        if target.id == request.user.id:
            raise serializers.ValidationError({"detail": "No puedes acceder como tu mismo."})
        if target.is_superuser or target.is_staff:
            raise serializers.ValidationError({"detail": "Solo se puede acceder como cliente o revendedor."})
        if not target.is_active:
            raise serializers.ValidationError({"detail": "El usuario destino esta suspendido."})

        AuditLog.objects.create(
            user=request.user,
            action=AuditLog.Action.USER_IMPERSONATED,
            target_type="user",
            target_id=str(target.id),
            target_label=target.username,
            metadata={
                "target_username": target.username,
                "target_role": serialize_user(target)["role"],
                "actor_username": request.user.get_username(),
            },
        )
        return Response(token_response_for_user(target))


class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.prefetch_related("permissions").all().order_by("name")
    serializer_class = GroupSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        ensure_default_staff_groups()
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        source = self.get_object()
        name = request.data.get("name") or f"{source.name} copia"
        duplicate = Group.objects.create(name=name)
        duplicate.permissions.set(source.permissions.all())
        return Response(self.get_serializer(duplicate).data, status=status.HTTP_201_CREATED)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.select_related("content_type").prefetch_related("group_set").all().order_by("content_type__app_label", "codename")
    serializer_class = PermissionSerializer
    permission_classes = [IsAdminUser]
    pagination_class = UserPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(codename__icontains=search) | Q(content_type__app_label__icontains=search))
        return queryset


class AccessSessionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AccessSession.objects.select_related("user").all()
    serializer_class = AccessSessionSerializer
    permission_classes = [IsAdminUser]
    pagination_class = UserPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        status_value = self.request.query_params.get("status")
        if search:
            queryset = queryset.filter(Q(user__username__icontains=search) | Q(user__email__icontains=search) | Q(ip_address__icontains=search) | Q(device__icontains=search) | Q(role__icontains=search))
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, _request, pk=None):
        session = self.get_object()
        session.status = AccessSession.Status.CLOSED
        session.closed_at = timezone.now()
        session.save(update_fields=["status", "closed_at", "updated_at"])
        return Response(self.get_serializer(session).data)


class AccessSecurityViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminUser]

    def list(self, _request):
        config = GlobalConfiguration.current()
        return Response(default_access_security(config.policies.get("access_security") or {}))

    def create(self, request):
        config = GlobalConfiguration.current()
        serializer = AccessSecuritySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        policies = dict(config.policies or {})
        policies["access_security"] = serializer.validated_data
        config.policies = policies
        config.save(update_fields=["policies", "updated_at"])
        return Response(default_access_security(serializer.validated_data))


def default_access_security(value):
    defaults = {
        "require_2fa_staff": False,
        "admin_ip_allowlist": [],
        "failed_login_limit": 5,
        "failed_login_window_minutes": 10,
        "session_timeout_hours": 8,
        "alert_new_device": True,
        "critical_actions_owner_only": True,
    }
    return {**defaults, **value}
