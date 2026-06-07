import asyncio
import json
import os
import subprocess
import time
from pathlib import Path
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication

from agents.models import AgentJob
from .models import AuditLog, HostingAccount
from .permissions import scoped_accounts


def _query_params(scope):
    return parse_qs(scope.get("query_string", b"").decode("utf-8", errors="ignore"))


def _first(params, key, default=""):
    values = params.get(key) or []
    return str(values[0] if values else default)


def _client_ip(scope):
    headers = {
        key.decode("latin1").lower(): value.decode("latin1")
        for key, value in scope.get("headers", [])
    }
    forwarded_for = headers.get("x-forwarded-for", "")
    client = scope.get("client") or ["", 0]
    remote_addr = client[0] if client else ""
    if forwarded_for and remote_addr in getattr(settings, "TRUSTED_PROXY_IPS", []):
        return forwarded_for.split(",")[0].strip() or None
    return remote_addr or None


def _relative_account_path(path):
    value = str(path or "/").strip().replace("\\", "/")
    if not value or value == ".":
        value = "/"
    return value if value.startswith("/") else f"/{value}"


def _safe_account_target(username, cwd):
    home = (Path(getattr(settings, "LOCAL_HOME_ROOT", "/home")) / username).resolve(strict=False)
    rel = _relative_account_path(cwd).lstrip("/")
    target = (home / rel).resolve(strict=False)
    if os.path.commonpath([str(home), str(target)]) != str(home):
        raise ValueError("Ruta fuera de la cuenta.")
    if not target.exists() or not target.is_dir():
        raise ValueError("El directorio de trabajo no existe.")
    return home, target, f"/{rel}".rstrip("/") or "/"


class HostingTerminalConsumer(AsyncWebsocketConsumer):
    channel_layer_alias = None
    idle_timeout_seconds = 30 * 60
    max_session_seconds = 4 * 60 * 60

    async def connect(self):
        self.account = None
        self.job = None
        self.master_fd = None
        self.process = None
        self.reader_task = None
        self.monitor_task = None
        self.started_at = time.monotonic()
        self.last_activity_at = time.monotonic()

        params = _query_params(self.scope)
        token = _first(params, "token")
        account_id = _first(params, "account")
        cwd = _first(params, "cwd", "/")
        cols = self._bounded_int(_first(params, "cols", "100"), 20, 240, 100)
        rows = self._bounded_int(_first(params, "rows", "30"), 8, 80, 30)

        auth = await self._authorize(token, account_id)
        if not auth:
            await self.close(code=4401)
            return
        user, account = auth
        self.user = user
        self.account = account

        try:
            home, target, rel = await asyncio.to_thread(_safe_account_target, account.username, cwd)
            self.home = home
            self.cwd = target
            self.cwd_rel = rel
            self.process = await asyncio.to_thread(self._spawn_shell, account.username, rel, cols, rows)
        except Exception as exc:
            await self.accept()
            await self.send_json({"type": "error", "detail": str(exc)})
            await self.close(code=4400)
            return

        await self.accept()
        self.job = await self._mark_started(user, account, rel)
        await self.send_json(
            {
                "type": "ready",
                "cwd": rel,
                "job_id": str(self.job.id) if self.job else "",
                "limits": {
                    "idle_timeout_seconds": self.idle_timeout_seconds,
                    "max_session_seconds": self.max_session_seconds,
                    "runs_as": account.username,
                    "scope": str(home),
                },
            }
        )
        self.reader_task = asyncio.create_task(self._read_pty())
        self.monitor_task = asyncio.create_task(self._monitor_lifetime())

    async def disconnect(self, code):
        await self._terminate_process()
        if self.reader_task:
            self.reader_task.cancel()
        if self.monitor_task:
            self.monitor_task.cancel()
        if self.job:
            await self._mark_finished(code)

    async def receive(self, text_data=None, bytes_data=None):
        self.last_activity_at = time.monotonic()
        if bytes_data:
            await self._write_pty(bytes_data)
            return
        try:
            message = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            message = {"type": "input", "data": text_data or ""}
        msg_type = message.get("type")
        if msg_type == "input":
            await self._write_pty(str(message.get("data") or "").encode())
        elif msg_type == "resize":
            cols = self._bounded_int(message.get("cols"), 20, 240, 100)
            rows = self._bounded_int(message.get("rows"), 8, 80, 30)
            await asyncio.to_thread(self._resize_pty, cols, rows)
        elif msg_type == "ping":
            await self.send_json({"type": "pong"})

    async def send_json(self, payload):
        await self.send(text_data=json.dumps(payload))

    async def _read_pty(self):
        while self.process and self.process.stdout:
            try:
                data = await asyncio.to_thread(os.read, self.process.stdout.fileno(), 4096)
            except OSError:
                break
            if not data:
                break
            await self.send(text_data=json.dumps({"type": "output", "data": data.decode("utf-8", errors="replace")}))
        await self.close(code=1000)

    async def _write_pty(self, data):
        if not self.process or not self.process.stdin or not data:
            return
        await asyncio.to_thread(self._write_process_stdin, data)

    def _write_process_stdin(self, data):
        if not self.process or not self.process.stdin:
            return
        os.write(self.process.stdin.fileno(), data)

    async def _monitor_lifetime(self):
        while True:
            await asyncio.sleep(15)
            now = time.monotonic()
            if now - self.started_at > self.max_session_seconds:
                await self.send_json({"type": "error", "detail": "La terminal alcanzo el tiempo maximo de sesion."})
                await self.close(code=4408)
                return
            if now - self.last_activity_at > self.idle_timeout_seconds:
                await self.send_json({"type": "error", "detail": "La terminal se cerro por inactividad."})
                await self.close(code=4408)
                return

    async def _terminate_process(self):
        process = self.process
        self.process = None
        if process and process.poll() is None:
            try:
                process.terminate()
            except OSError:
                pass
            try:
                await asyncio.to_thread(process.wait, 2)
            except Exception:
                process.kill()

    def _spawn_shell(self, username, cwd, cols, rows):
        helper = str(getattr(settings, "LOCAL_TERMINAL_PTY_HELPER", "/usr/local/sbin/ehpanel-terminal-pty"))
        if not Path(helper).exists():
            raise RuntimeError(f"No existe el broker de terminal: {helper}")
        return subprocess.Popen(
            ["sudo", "-n", helper, username, str(cwd), str(cols), str(rows)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            close_fds=True,
        )

    def _resize_pty(self, cols, rows):
        return

    @staticmethod
    def _ioctl_resize(fd, cols, rows, fcntl_module, termios_module, struct_module):
        packed = struct_module.pack("HHHH", rows, cols, 0, 0)
        fcntl_module.ioctl(fd, termios_module.TIOCSWINSZ, packed)

    @staticmethod
    def _bounded_int(value, minimum, maximum, default):
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            parsed = default
        return max(minimum, min(maximum, parsed))

    @database_sync_to_async
    def _authorize(self, token, account_id):
        if not token or not account_id:
            return None
        try:
            jwt_auth = JWTAuthentication()
            validated = jwt_auth.get_validated_token(token)
            user = jwt_auth.get_user(validated)
        except Exception:
            return None
        account = scoped_accounts(HostingAccount.objects.select_related("node"), user).filter(id=account_id).first()
        if not account:
            return None
        return user, account

    @database_sync_to_async
    def _mark_started(self, user, account, cwd):
        job = AgentJob.objects.create(
            node=account.node,
            job_type=AgentJob.Type.SERVICE_ACTION,
            payload={
                "action": "shell_terminal",
                "account_id": str(account.id),
                "cwd": cwd,
                "requested_by": user.get_username(),
                "username": account.username,
            },
        )
        job.mark_running()
        AuditLog.objects.create(
            user=user,
            action=AuditLog.Action.ACCOUNT_UPDATED,
            account=account,
            target_type="HostingAccount",
            target_id=str(account.id),
            target_label=str(account),
            ip=_client_ip(self.scope),
            metadata={"advanced_action": "shell_terminal_start", "cwd": cwd, "job": str(job.id), "path": self.scope.get("path", "")},
        )
        return job

    @database_sync_to_async
    def _mark_finished(self, code):
        duration = round(time.monotonic() - self.started_at, 3)
        self.job.mark_success({"action": "shell_terminal", "cwd": self.cwd_rel, "duration_seconds": duration, "close_code": code})
        AuditLog.objects.create(
            user=self.user,
            action=AuditLog.Action.ACCOUNT_UPDATED,
            account=self.account,
            target_type="HostingAccount",
            target_id=str(self.account.id),
            target_label=str(self.account),
            ip=_client_ip(self.scope),
            metadata={"advanced_action": "shell_terminal_close", "cwd": self.cwd_rel, "duration_seconds": duration, "job": str(self.job.id), "close_code": code},
        )
