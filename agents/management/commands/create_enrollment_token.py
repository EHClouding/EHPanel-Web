from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from agents.models import EnrollmentToken, Node


class Command(BaseCommand):
    help = "Create a one-use enrollment token for an agent node."

    def add_arguments(self, parser):
        parser.add_argument("hostname")
        parser.add_argument("--agent-type", default=Node.AgentType.WEB, choices=[choice[0] for choice in Node.AgentType.choices])
        parser.add_argument("--ttl-hours", type=int, default=24)

    def handle(self, *args, **options):
        token = EnrollmentToken.objects.create(
            hostname=options["hostname"],
            agent_type=options["agent_type"],
            expires_at=timezone.now() + timedelta(hours=options["ttl_hours"]),
        )
        self.stdout.write(self.style.SUCCESS(token.token))
