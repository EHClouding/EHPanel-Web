from django.urls import path

from .consumers import AgentConsumer
from ehpanel_web.core_ws import CoreConsumer
from hosting.terminal_ws import HostingTerminalConsumer

websocket_urlpatterns = [
    path("ws/agent/", AgentConsumer.as_asgi()),
    path("ws/core/", CoreConsumer.as_asgi()),
    path("ws/hosting-terminal/", HostingTerminalConsumer.as_asgi()),
]
