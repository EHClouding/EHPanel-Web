from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings

from .core_integration import _core_auth_valid, core_connection_payload


def _headers(scope):
    return {
        key.decode("latin1").lower(): value.decode("latin1")
        for key, value in scope.get("headers", [])
    }


def _bearer(value):
    value = str(value or "").strip()
    if value.startswith("Bearer "):
        return value.removeprefix("Bearer ").strip()
    return ""


class CoreConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        headers = _headers(self.scope)
        api_user = headers.get("x-api-user", "").strip()
        api_key = headers.get("x-api-key", "").strip() or _bearer(headers.get("authorization", ""))
        if not await self._is_authorized(api_user, api_key):
            await self.close(code=4401)
            return
        await self.accept()
        await self.send_json(await self._hello_payload())

    async def receive_json(self, content, **_kwargs):
        msg_type = content.get("msg_type") or content.get("type") or "core.ping"
        if msg_type in {"core.ping", "ping"}:
            await self.send_json(await self._hello_payload(msg_type="core.pong"))
            return
        await self.send_json(
            {
                "msg_type": "core.ack",
                "payload": {
                    "ok": True,
                    "received": msg_type,
                    "deploy_enabled": bool(getattr(settings, "CORE_ALLOW_DEPLOY", False)),
                },
            }
        )

    @database_sync_to_async
    def _is_authorized(self, api_user, api_key):
        return _core_auth_valid(api_user, api_key)

    @database_sync_to_async
    def _hello_payload(self, msg_type="core.hello"):
        return {
            "msg_type": msg_type,
            "payload": {
                "ok": True,
                "status": "online",
                "connection": core_connection_payload(),
            },
        }
