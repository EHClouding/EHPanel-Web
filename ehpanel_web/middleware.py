import logging

from django.http import JsonResponse

logger = logging.getLogger(__name__)


class ApiExceptionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except Exception:
            if request.path.startswith("/api/"):
                logger.exception("Unhandled API error on %s %s", request.method, request.path)
                return JsonResponse(
                    {"detail": "Error interno del servidor.", "status_code": 500},
                    status=500,
                )
            raise
