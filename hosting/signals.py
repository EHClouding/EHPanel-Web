from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from agents.models import Node


@receiver(post_save, sender=Node)
def create_nameservers_for_new_web_node(sender, instance, created, **_kwargs):
    if not created or instance.agent_type != Node.AgentType.WEB:
        return

    def _create_defaults():
        from .services import ensure_default_nameservers_for_node

        ensure_default_nameservers_for_node(instance)

    transaction.on_commit(_create_defaults)
