import json
from dataclasses import dataclass
from urllib import error, request

from django.conf import settings


class BillingClientError(Exception):
    pass


@dataclass
class BillingClient:
    base_url: str = ""
    token: str = ""

    def __post_init__(self):
        if not self.base_url:
            self.base_url = getattr(settings, "BILLING_API_BASE", "https://panel.ehclouding.com/api/v1")
        if not self.token:
            self.token = getattr(settings, "BILLING_API_TOKEN", "")

    def is_configured(self):
        return bool(self.base_url and self.token)

    def request(self, method, path, payload=None, timeout=10):
        if not self.is_configured():
            raise BillingClientError("BILLING_API_TOKEN no esta configurado.")
        path = f"/{str(path).lstrip('/')}"
        url = f"{self.base_url.rstrip('/')}{path}"
        body = None
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.token}",
        }
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = request.Request(url, data=body, headers=headers, method=method.upper())
        try:
            with request.urlopen(req, timeout=timeout) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise BillingClientError(f"Billing respondio HTTP {exc.code}: {detail[:300]}") from exc
        except (error.URLError, TimeoutError, ValueError) as exc:
            raise BillingClientError(f"No se pudo contactar Billing: {exc}") from exc

    def health(self):
        return self.request("GET", "/health/")


def billing_client():
    return BillingClient()
