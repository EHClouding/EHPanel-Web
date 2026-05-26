from django.core.management.base import BaseCommand

from hosting.local_provisioning import ensure_local_node


class Command(BaseCommand):
    help = "Create or refresh the local EHPanel Web node record."

    def handle(self, *args, **options):
        node = ensure_local_node()
        self.stdout.write(self.style.SUCCESS(f"Local node ready: {node.hostname} ({node.id})"))
