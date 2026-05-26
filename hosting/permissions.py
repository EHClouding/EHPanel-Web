from rest_framework.permissions import BasePermission


def is_admin_user(user):
    return bool(user and user.is_authenticated and (user.is_superuser or user.is_staff))


def reseller_profile_for_user(user):
    if not user or not user.is_authenticated:
        return None
    profile = getattr(user, "hosting_reseller_profile", None)
    if profile is not None:
        return profile
    membership = getattr(user, "reseller_team_membership", None)
    if membership is not None and membership.status == "active":
        return membership.reseller
    return None


def is_reseller_team_user(user):
    return bool(getattr(user, "reseller_team_membership", None))


def scoped_accounts(queryset, user):
    if is_admin_user(user):
        return queryset
    if not user or not user.is_authenticated:
        return queryset.none()

    reseller_profile = reseller_profile_for_user(user)
    if reseller_profile is not None:
        return queryset.filter(reseller=reseller_profile.user)
    return queryset.filter(owner=user)


def user_can_access_account(user, account):
    if is_admin_user(user):
        return True
    if not user or not user.is_authenticated:
        return False
    if not hasattr(account, "owner_id") or not hasattr(account, "reseller_id"):
        return False
    reseller_profile = reseller_profile_for_user(user)
    reseller_user_id = reseller_profile.user_id if reseller_profile is not None else None
    return account.owner_id == user.id or account.reseller_id == user.id or account.reseller_id == reseller_user_id


class IsAdminOrScopedUser(BasePermission):
    def has_permission(self, request, _view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, _view, obj):
        account = getattr(obj, "account", None)
        if account is None and hasattr(obj, "domain"):
            account = getattr(obj.domain, "account", None)
        if account is None and hasattr(obj, "message"):
            account = getattr(getattr(obj.message, "ticket", None), "account", None)
        if account is None and hasattr(obj, "ticket"):
            account = getattr(obj.ticket, "account", None)
        if account is None:
            account = obj
        return user_can_access_account(request.user, account)
