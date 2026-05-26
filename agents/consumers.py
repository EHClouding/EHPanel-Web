import hmac
import json
from datetime import timedelta

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.utils import timezone

from .models import AgentEvent, AgentJob, EnrollmentToken, Node


class AgentConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.node = None
        self.node_group_name = ""
        await self.accept()
        await self.send_json({"msg_type": "panel.hello", "payload": {"proto": "ehagent/1.0"}})

    async def receive_json(self, content, **kwargs):
        msg_type = content.get("msg_type")
        payload = content.get("payload") or {}
        msg_id = content.get("msg_id", "")

        if msg_type == "enrollment.register":
            response = await self.handle_enrollment(payload, msg_id)
            await self.add_current_node_to_group()
            await self.send_json(response)
            await self.dispatch_queued_jobs()
            return

        if msg_type == "agent.resume":
            response = await self.handle_resume(payload, msg_id)
            if response.get("msg_type") == "agent.resume.accepted":
                await self.add_current_node_to_group()
                await self.send_json(response)
                await self.dispatch_queued_jobs()
                return
            await self.send_json(response)
            return

        if not self.node:
            await self.send_error("NOT_ENROLLED", "Agent must enroll before sending messages.")
            return

        if msg_type == "heartbeat":
            await self.handle_heartbeat(payload, msg_id)
            await self.send_json({"msg_type": "heartbeat.ack", "payload": {"state": self.node.state}})
            return

        if msg_type == "capabilities.report":
            await self.handle_capabilities(payload, msg_id)
            await self.send_json({"msg_type": "capabilities.ack", "payload": {"ok": True}})
            return

        if msg_type == "telemetry.report":
            await self.handle_telemetry(payload, msg_id)
            await self.send_json({"msg_type": "telemetry.ack", "payload": {"ok": True}})
            return

        if msg_type == "job.started":
            response = await self.handle_job_started(payload, msg_id)
            await self.send_json(response)
            return

        if msg_type == "job.completed":
            response = await self.handle_job_completed(payload, msg_id)
            await self.send_json(response)
            return

        if msg_type == "job.failed":
            response = await self.handle_job_failed(payload, msg_id)
            await self.send_json(response)
            return

        await self.send_error("UNKNOWN_MESSAGE", f"Unsupported msg_type: {msg_type}")

    async def disconnect(self, code):
        if self.node:
            if self.node_group_name:
                await self.channel_layer.group_discard(self.node_group_name, self.channel_name)
            await self.mark_offline_if_stale(self.node.id)

    async def job_run(self, event):
        payload = event["payload"]
        correlation_id = event["correlation_id"]
        await self.send_json(
            {
                "msg_type": "job.run",
                "msg_id": correlation_id,
                "payload": payload,
            }
        )
        await self.mark_job_sent(payload["job_id"], correlation_id)

    async def send_error(self, code, detail):
        await self.send_json({"msg_type": "error", "payload": {"code": code, "detail": detail}})

    @database_sync_to_async
    def handle_enrollment(self, payload, msg_id):
        token_value = payload.get("enrollment_token")
        hostname = payload.get("hostname")
        agent_type = payload.get("agent_type", Node.AgentType.WEB)
        if not token_value or not hostname:
            return {"msg_type": "error", "payload": {"code": "INVALID_ENROLLMENT", "detail": "Missing token or hostname."}}

        try:
            token = EnrollmentToken.objects.get(token=token_value, hostname=hostname, agent_type=agent_type)
        except EnrollmentToken.DoesNotExist:
            return {"msg_type": "error", "payload": {"code": "INVALID_TOKEN", "detail": "Enrollment token not found."}}

        if not token.is_valid:
            return {"msg_type": "error", "payload": {"code": "TOKEN_EXPIRED_OR_USED", "detail": "Enrollment token is not valid."}}

        node, _ = Node.objects.update_or_create(
            hostname=hostname,
            defaults={
                "agent_type": agent_type,
                "state": Node.State.ONLINE,
                "agent_version": payload.get("agent_version", ""),
                "os_name": payload.get("os", ""),
                "arch": payload.get("arch", ""),
                "last_seen_at": timezone.now(),
            },
        )
        token.consume(node)
        AgentEvent.objects.create(node=node, msg_type="enrollment.register", msg_id=msg_id, payload=payload)
        self.node = node
        self.node_group_name = self.group_name(node.id)
        return {"msg_type": "enrollment.accepted", "payload": {"node_id": str(node.id), "agent_secret": node.agent_secret, "heartbeat_interval_s": 15}}

    @database_sync_to_async
    def handle_resume(self, payload, msg_id):
        node_id = payload.get("node_id")
        hostname = payload.get("hostname")
        if not node_id or not hostname:
            return {"msg_type": "error", "payload": {"code": "INVALID_RESUME", "detail": "Missing node_id or hostname."}}

        try:
            node = Node.objects.get(id=node_id, hostname=hostname)
        except Node.DoesNotExist:
            return {"msg_type": "error", "payload": {"code": "NODE_NOT_FOUND", "detail": "Node not found."}}

        agent_secret = str(payload.get("agent_secret") or "")
        if not agent_secret or not hmac.compare_digest(agent_secret, node.agent_secret):
            if not getattr(settings, "AGENT_ALLOW_LEGACY_RESUME", False):
                AgentEvent.objects.create(node=node, msg_type="agent.resume.denied", msg_id=msg_id, payload={"reason": "AUTH_FAILED"})
                return {"msg_type": "error", "payload": {"code": "AUTH_FAILED", "detail": "Invalid agent credentials."}}

        node.state = Node.State.ONLINE
        node.last_seen_at = timezone.now()
        node.agent_version = payload.get("agent_version", node.agent_version) or node.agent_version
        node.os_name = payload.get("os", node.os_name) or node.os_name
        node.arch = payload.get("arch", node.arch) or node.arch
        node.save(update_fields=["state", "last_seen_at", "agent_version", "os_name", "arch", "updated_at"])
        AgentEvent.objects.create(node=node, msg_type="agent.resume", msg_id=msg_id, payload=payload)
        self.node = node
        self.node_group_name = self.group_name(node.id)
        return {"msg_type": "agent.resume.accepted", "payload": {"node_id": str(node.id), "heartbeat_interval_s": 15}}

    async def add_current_node_to_group(self):
        if self.node and self.node_group_name:
            await self.channel_layer.group_add(self.node_group_name, self.channel_name)

    async def dispatch_queued_jobs(self):
        if not self.node:
            return
        for job in await self.get_queued_jobs():
            correlation_id = f"job_{job['id']}"
            await self.send_json(
                {
                    "msg_type": "job.run",
                    "msg_id": correlation_id,
                    "payload": {
                        "job_id": job["id"],
                        "job_type": job["job_type"],
                        "payload": job["payload"],
                    },
                }
            )
            await self.mark_job_sent(job["id"], correlation_id)

    @database_sync_to_async
    def get_queued_jobs(self):
        jobs = AgentJob.objects.filter(node=self.node, status=AgentJob.Status.QUEUED).order_by("queued_at")[:20]
        return [{"id": str(job.id), "job_type": job.job_type, "payload": job.payload} for job in jobs]

    @database_sync_to_async
    def handle_heartbeat(self, payload, msg_id):
        self.node.state = payload.get("node_state", Node.State.ONLINE)
        self.node.last_seen_at = timezone.now()
        self.node.save(update_fields=["state", "last_seen_at", "updated_at"])
        AgentEvent.objects.create(node=self.node, msg_type="heartbeat", msg_id=msg_id, payload=payload)

    @database_sync_to_async
    def handle_capabilities(self, payload, msg_id):
        self.node.capabilities = payload
        self.node.agent_version = payload.get("agent_version", self.node.agent_version) or self.node.agent_version
        self.node.os_name = payload.get("os", self.node.os_name) or self.node.os_name
        self.node.arch = payload.get("arch", self.node.arch) or self.node.arch
        self.node.save(update_fields=["capabilities", "agent_version", "os_name", "arch", "updated_at"])
        AgentEvent.objects.create(node=self.node, msg_type="capabilities.report", msg_id=msg_id, payload=payload)

    @database_sync_to_async
    def handle_telemetry(self, payload, msg_id):
        self.node.last_telemetry = payload
        self.node.save(update_fields=["last_telemetry", "updated_at"])
        AgentEvent.objects.create(node=self.node, msg_type="telemetry.report", msg_id=msg_id, payload=payload)

    @database_sync_to_async
    def handle_job_started(self, payload, msg_id):
        job = self.get_node_job(payload)
        if not job:
            return {"msg_type": "job.ack", "payload": {"ok": False, "code": "JOB_NOT_FOUND"}}
        job.mark_running()
        sync_hosting_job(job)
        AgentEvent.objects.create(node=self.node, msg_type="job.started", msg_id=msg_id, payload=payload)
        return {"msg_type": "job.ack", "payload": {"ok": True, "job_id": str(job.id)}}

    @database_sync_to_async
    def handle_job_completed(self, payload, msg_id):
        job = self.get_node_job(payload)
        if not job:
            return {"msg_type": "job.ack", "payload": {"ok": False, "code": "JOB_NOT_FOUND"}}
        job.mark_success(payload.get("result") or {})
        sync_hosting_job(job)
        AgentEvent.objects.create(node=self.node, msg_type="job.completed", msg_id=msg_id, payload=payload)
        return {"msg_type": "job.ack", "payload": {"ok": True, "job_id": str(job.id)}}

    @database_sync_to_async
    def handle_job_failed(self, payload, msg_id):
        job = self.get_node_job(payload)
        if not job:
            return {"msg_type": "job.ack", "payload": {"ok": False, "code": "JOB_NOT_FOUND"}}
        job.mark_failed(
            code=payload.get("error_code", ""),
            detail=payload.get("error_detail", ""),
            result=payload.get("result") or {},
        )
        sync_hosting_job(job)
        AgentEvent.objects.create(node=self.node, msg_type="job.failed", msg_id=msg_id, payload=payload)
        return {"msg_type": "job.ack", "payload": {"ok": True, "job_id": str(job.id)}}

    def get_node_job(self, payload):
        job_id = payload.get("job_id")
        if not job_id:
            return None
        try:
            return AgentJob.objects.get(id=job_id, node=self.node)
        except AgentJob.DoesNotExist:
            return None

    @database_sync_to_async
    def mark_job_sent(self, job_id, correlation_id):
        try:
            job = AgentJob.objects.get(id=job_id, node=self.node)
        except AgentJob.DoesNotExist:
            return
        job.mark_sent(correlation_id)

    @staticmethod
    def group_name(node_id):
        return f"node_{str(node_id).replace('-', '_')}"

    @database_sync_to_async
    def mark_offline_if_stale(self, node_id):
        timeout = timezone.now() - timedelta(seconds=settings.AGENT_HEARTBEAT_TIMEOUT_SECONDS)
        Node.objects.filter(id=node_id, last_seen_at__lt=timeout).update(state=Node.State.OFFLINE)


def sync_hosting_job(job):
    try:
        from hosting.services import sync_job_side_effects

        sync_job_side_effects(job)
    except Exception:
        # Job acknowledgement must not fail because a local projection update failed.
        return
