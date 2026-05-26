import hashlib

from django.utils import timezone
from rest_framework import authentication, exceptions

from .models import ApiKeyCredential


class ApiKeyAuthentication(authentication.BaseAuthentication):
    keyword = "Api-Key"

    def authenticate(self, request):
        token = self._extract_token(request)
        if not token:
            return None

        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        credential = (
            ApiKeyCredential.objects.select_related("created_by")
            .filter(key_hash=token_hash, status=ApiKeyCredential.Status.ACTIVE)
            .first()
        )
        if not credential or not credential.created_by or not credential.created_by.is_active:
            raise exceptions.AuthenticationFailed("Clave API invalida o revocada.")
        if credential.route and not request.path.startswith(credential.route):
            raise exceptions.AuthenticationFailed("Clave API no autorizada para esta ruta.")
        scopes = credential.scopes if isinstance(credential.scopes, list) else []
        if request.method not in ("GET", "HEAD", "OPTIONS") and "write" not in scopes:
            raise exceptions.AuthenticationFailed("Clave API sin permiso de escritura.")

        credential.last_used_at = timezone.now()
        credential.save(update_fields=["last_used_at", "updated_at"])
        return credential.created_by, credential

    def _extract_token(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8").strip()
        if header:
            if header.startswith(f"{self.keyword} "):
                return header[len(self.keyword) + 1 :].strip()
            if header.startswith("Bearer ehp_"):
                return header[len("Bearer ") :].strip()

        token = request.META.get("HTTP_X_EHPANEL_API_KEY")
        return token.strip() if isinstance(token, str) and token.strip() else None
