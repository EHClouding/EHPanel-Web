from django.urls import path

from .consumers import AgentConsumer
from ehpanel_web.core_ws import CoreConsumer

websocket_urlpatterns = [
    path("ws/agent/", AgentConsumer.as_asgi()),
    path("ws/core/", CoreConsumer.as_asgi()),
]
