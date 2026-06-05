from django.core.management.base import BaseCommand, CommandError

from agents.models import AgentJob
from hosting.local_provisioning import execute_local_job, is_local_provisioning_enabled, sync_local_job_post_effects
from hosting.models import ProvisioningRun


class Command(BaseCommand):
    help = "Run one local provisioning job outside the web request process."

    def add_arguments(self, parser):
        parser.add_argument("job_id")
        parser.add_argument("--run-id", default="")
        parser.add_argument("--account-id", default="")
        parser.add_argument("--force", action="store_true")

    def handle(self, *args, **options):
        if not is_local_provisioning_enabled():
            raise CommandError("Local provisioning is not enabled.")

        job = AgentJob.objects.filter(id=options["job_id"]).first()
        if not job:
            raise CommandError(f"Job not found: {options['job_id']}")
        if job.status in {AgentJob.Status.SUCCESS, AgentJob.Status.FAILED} and not options["force"]:
            self.stdout.write(f"Job {job.id} already finished with status {job.status}.")
            return

        run = None
        if options.get("run_id"):
            run = ProvisioningRun.objects.filter(id=options["run_id"]).first()

        execute_local_job(job)
        sync_local_job_post_effects(job, run=run, account_id=options.get("account_id") or None)
        self.stdout.write(f"Job {job.id} finished with status {job.status}.")
