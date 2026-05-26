from django.core.management.base import BaseCommand

from hosting.local_metrics import refresh_local_metrics


class Command(BaseCommand):
    help = "Refresh local node telemetry and active hosting account usage."

    def handle(self, *args, **options):
        result = refresh_local_metrics()
        system = (result.get("node") or {}).get("system") or {}
        self.stdout.write(
            self.style.SUCCESS(
                "Local metrics refreshed: "
                f"accounts={result.get('accounts_refreshed', 0)} "
                f"cpu={system.get('cpu_pct', 0)}% "
                f"ram={system.get('ram_used_mb', 0)}/{system.get('ram_total_mb', 0)}MB"
            )
        )
