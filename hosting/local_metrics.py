import os
import platform
import re
import shutil
import socket
import subprocess
import time
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from agents.models import Node
from .local_provisioning import ensure_local_node, local_public_ip
from .models import HostingAccount


SAFE_USERNAME = re.compile(r"^[a-z_][a-z0-9_-]{0,31}$")
ACCESS_LINE = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] "(?P<method>\S+) (?P<path>\S+) (?P<proto>[^"]+)" '
    r"(?P<status>\d{3}) (?P<bytes>\S+)"
)


def _round(value, digits=2):
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return 0


def _mb(value):
    return _round((value or 0) / 1024 / 1024)


def _gb(value):
    return _round((value or 0) / 1024 / 1024 / 1024)


def _run(command, timeout=8):
    return subprocess.run(command, text=True, capture_output=True, timeout=timeout, check=False)


def _read_meminfo():
    values = {}
    try:
        with open("/proc/meminfo", "r", encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                key, raw = line.split(":", 1)
                values[key] = int(raw.strip().split()[0]) * 1024
    except (OSError, ValueError):
        return {}
    total = values.get("MemTotal", 0)
    available = values.get("MemAvailable", 0)
    return {"total": total, "used": max(total - available, 0), "available": available}


def _read_cpu_jiffies():
    try:
        with open("/proc/stat", "r", encoding="utf-8", errors="ignore") as handle:
            parts = handle.readline().split()
    except OSError:
        return None
    if not parts or parts[0] != "cpu":
        return None
    numbers = [int(value) for value in parts[1:]]
    idle = numbers[3] + (numbers[4] if len(numbers) > 4 else 0)
    return sum(numbers), idle


def _cpu_percent(interval=0.15):
    first = _read_cpu_jiffies()
    if not first:
        return 0
    time.sleep(interval)
    second = _read_cpu_jiffies()
    if not second:
        return 0
    total_delta = second[0] - first[0]
    idle_delta = second[1] - first[1]
    if total_delta <= 0:
        return 0
    return _round((1 - (idle_delta / total_delta)) * 100)


def _directory_size_bytes(path):
    target = Path(path)
    if not target.exists():
        return 0
    try:
        completed = _run(["du", "-sb", str(target)], timeout=20)
        if completed.returncode == 0 and completed.stdout.strip():
            return int(completed.stdout.split()[0])
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass

    total = 0
    for root, _dirs, files in os.walk(target, onerror=lambda _exc: None):
        for name in files:
            try:
                total += (Path(root) / name).stat().st_size
            except OSError:
                continue
    return total


def _service_status(service_names):
    services = []
    for name in service_names:
        status_value = "unknown"
        enabled = "unknown"
        try:
            active = _run(["systemctl", "is-active", name], timeout=5)
            if active.returncode == 0:
                status_value = "active"
            elif active.stdout.strip():
                status_value = active.stdout.strip()
            else:
                status_value = "inactive"
        except (OSError, subprocess.TimeoutExpired):
            pass
        try:
            enabled_result = _run(["systemctl", "is-enabled", name], timeout=5)
            enabled = enabled_result.stdout.strip() or "unknown"
        except (OSError, subprocess.TimeoutExpired):
            pass
        services.append({"name": name, "status": status_value, "enabled": enabled})
    return services


def _php_version_from_binary(binary):
    try:
        completed = _run(
            [str(binary), "-r", "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;"],
            timeout=5,
        )
        if completed.returncode == 0 and completed.stdout.strip():
            return completed.stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        pass
    return ""


def _version_from_lsphp_handler(handler):
    match = re.search(r"lsphp([0-9])([0-9])$", handler)
    if not match:
        return ""
    return f"{match.group(1)}.{match.group(2)}"


def _detect_lsphp_versions():
    ols_home = Path(getattr(settings, "LOCAL_OLS_HOME", "/usr/local/lsws"))
    rows = []
    for binary in sorted(ols_home.glob("lsphp*/bin/php")):
        handler = binary.parent.parent.name
        version = _php_version_from_binary(binary) or _version_from_lsphp_handler(handler)
        if not version:
            continue
        rows.append(
            {
                "version": version,
                "handler": handler,
                "binary": str(binary),
                "sapi": "lsapi",
                "status": "active",
            }
        )
    return rows


def collect_node_telemetry(node=None):
    node = node or ensure_local_node()
    disk = shutil.disk_usage("/")
    mem = _read_meminfo()
    try:
        load_1m, load_5m, load_15m = os.getloadavg()
    except OSError:
        load_1m = load_5m = load_15m = 0

    services = _service_status(["nginx", "lshttpd", "ehpanel-web", "postgresql", "mariadb", "valkey", "php-fpm"])
    lsphp_versions = _detect_lsphp_versions()
    php_versions = [item["version"] for item in lsphp_versions]
    system = {
        "cpu_pct": _cpu_percent(),
        "cpu_count": os.cpu_count() or 0,
        "ram_used_mb": _mb(mem.get("used")),
        "ram_total_mb": _mb(mem.get("total")),
        "ram_available_mb": _mb(mem.get("available")),
        "disk_used_gb": _gb(disk.used),
        "disk_total_gb": _gb(disk.total),
        "disk_free_gb": _gb(disk.free),
        "disk_used_pct": _round((disk.used / disk.total) * 100 if disk.total else 0),
        "load_1m": _round(load_1m),
        "load_5m": _round(load_5m),
        "load_15m": _round(load_15m),
        "hostname": socket.getfqdn() or socket.gethostname(),
        "platform": platform.platform(),
    }
    telemetry = {
        **(node.last_telemetry if isinstance(node.last_telemetry, dict) else {}),
        "public_ip": local_public_ip(),
        "system": system,
        "services": services,
        "lsphp_versions": lsphp_versions,
        "php_versions": php_versions,
        "php": {
            "installed": lsphp_versions,
            "versions": php_versions,
        },
        "collected_at": timezone.now().isoformat(),
    }
    capabilities = node.capabilities if isinstance(node.capabilities, dict) else {}
    capabilities.update(
        {
            "local_panel": True,
            "provisioning_mode": "local",
            "services": services,
            "lsphp_versions": lsphp_versions,
            "php_versions": php_versions,
            "php": {
                "installed": lsphp_versions,
                "versions": php_versions,
            },
            "web_engine": getattr(settings, "HOSTING_DEFAULT_WEB_ENGINE", "openlitespeed"),
            "edge": "nginx",
            "backend": "openlitespeed",
            "public_ip": telemetry["public_ip"],
        }
    )
    node.agent_type = Node.AgentType.WEB
    node.agent_version = "local-panel"
    node.state = Node.State.ONLINE
    node.os_name = platform.platform()
    node.arch = platform.machine()
    node.last_seen_at = timezone.now()
    node.last_telemetry = telemetry
    node.capabilities = capabilities
    node.save(
        update_fields=[
            "agent_type",
            "agent_version",
            "state",
            "os_name",
            "arch",
            "last_seen_at",
            "last_telemetry",
            "capabilities",
            "updated_at",
        ]
    )
    return telemetry


def _safe_account_paths(account):
    username = str(account.username or "")
    if not SAFE_USERNAME.match(username):
        raise ValueError("Nombre de usuario invalido para metricas locales.")
    home_root = Path(getattr(settings, "LOCAL_HOME_ROOT", "/home"))
    home = (home_root / username).resolve()
    if home_root.resolve() not in [home, *home.parents]:
        raise ValueError("Ruta home fuera de LOCAL_HOME_ROOT.")
    return {
        "home": home,
        "public_html": home / "public_html",
        "logs": home / "logs",
        "tmp": home / "tmp",
        "mail": Path("/var/vmail") / account.primary_domain,
    }


def _tail_lines(path, max_lines=5000):
    target = Path(path)
    if not target.exists():
        return []
    try:
        completed = _run(["tail", "-n", str(max_lines), str(target)], timeout=10)
        if completed.returncode == 0:
            return completed.stdout.splitlines()
    except (OSError, subprocess.TimeoutExpired):
        pass
    try:
        with target.open("r", encoding="utf-8", errors="ignore") as handle:
            return handle.readlines()[-max_lines:]
    except OSError:
        return []


def _parse_access_logs(log_dir):
    requests = 0
    bytes_sent = 0
    ips = set()
    status_classes = Counter()
    top_paths = Counter()
    hourly = Counter()
    recent_errors = []
    latest_at = ""

    for name in ["nginx-access.log", "nginx-ssl-access.log"]:
        for line in _tail_lines(Path(log_dir) / name):
            match = ACCESS_LINE.search(line)
            if not match:
                continue
            requests += 1
            ips.add(match.group("ip"))
            status_code = int(match.group("status"))
            status_classes[f"{status_code // 100}xx"] += 1
            top_paths[match.group("path").split("?", 1)[0]] += 1
            raw_bytes = match.group("bytes")
            if raw_bytes.isdigit():
                bytes_sent += int(raw_bytes)
            parsed_at = _parse_nginx_time(match.group("time"))
            if parsed_at:
                hourly[parsed_at.strftime("%Y-%m-%d %H:00")] += 1
                latest_at = max(latest_at, parsed_at.isoformat())
            if status_code >= 400:
                recent_errors.append(
                    {
                        "status": status_code,
                        "path": match.group("path"),
                        "ip": match.group("ip"),
                        "time": match.group("time"),
                    }
                )

    return {
        "requests": requests,
        "unique_visitors": len(ips),
        "bytes": bytes_sent,
        "bandwidth_mb": _mb(bytes_sent),
        "status_classes": dict(status_classes),
        "top_paths": [{"path": path, "requests": count} for path, count in top_paths.most_common(10)],
        "recent_errors": recent_errors[-20:],
        "hourly": _hourly_series(hourly),
        "latest_request_at": latest_at,
    }


def _parse_nginx_time(value):
    try:
        return datetime.strptime(value.split()[0], "%d/%b/%Y:%H:%M:%S")
    except (ValueError, IndexError):
        return None


def _hourly_series(counter):
    now = timezone.now().replace(minute=0, second=0, microsecond=0)
    values = []
    for offset in range(23, -1, -1):
        key = (now - timedelta(hours=offset)).strftime("%Y-%m-%d %H:00")
        values.append(counter.get(key, 0))
    return values


def _process_usage(username):
    try:
        pgrep = _run(["pgrep", "-u", username], timeout=5)
    except (OSError, subprocess.TimeoutExpired):
        return {"processes": 0, "ram_used_bytes": 0, "cpu_pct": 0}
    pids = [pid for pid in pgrep.stdout.split() if pid.isdigit()]
    if not pids:
        return {"processes": 0, "ram_used_bytes": 0, "cpu_pct": 0}
    try:
        ps = _run(["ps", "-o", "rss=,pcpu=", "-p", ",".join(pids)], timeout=8)
    except (OSError, subprocess.TimeoutExpired):
        return {"processes": len(pids), "ram_used_bytes": 0, "cpu_pct": 0}
    rss_kb = 0
    cpu = 0.0
    for line in ps.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 2:
            try:
                rss_kb += int(float(parts[0]))
                cpu += float(parts[1])
            except ValueError:
                continue
    return {"processes": len(pids), "ram_used_bytes": rss_kb * 1024, "cpu_pct": _round(cpu)}


def _quota_usage(username):
    try:
        completed = _run(["quota", "-u", username], timeout=8)
    except (OSError, subprocess.TimeoutExpired):
        return {"available": False}
    if completed.returncode != 0:
        return {"available": False, "detail": completed.stderr.strip() or completed.stdout.strip()}
    return {"available": True, "raw": completed.stdout.strip()}


def collect_account_usage_local(account):
    paths = _safe_account_paths(account)
    http = _parse_access_logs(paths["logs"])
    processes = _process_usage(account.username)
    files_bytes = _directory_size_bytes(paths["public_html"])
    logs_bytes = _directory_size_bytes(paths["logs"])
    tmp_bytes = _directory_size_bytes(paths["tmp"])
    mail_bytes = _directory_size_bytes(paths["mail"])
    disk_bytes = _directory_size_bytes(paths["home"])
    bandwidth_bytes = int(http.get("bytes") or 0)

    return {
        "disk_used_mb": _mb(disk_bytes),
        "ram_used_mb": _mb(processes["ram_used_bytes"]),
        "ram_used_bytes": processes["ram_used_bytes"],
        "cpu_pct": processes["cpu_pct"],
        "processes": processes["processes"],
        "bandwidth_used_mb": _mb(bandwidth_bytes),
        "bandwidth_bytes": bandwidth_bytes,
        "http": http,
        "storage": {
            "files_mb": _mb(files_bytes),
            "logs_mb": _mb(logs_bytes),
            "tmp_mb": _mb(tmp_bytes),
            "mail_mb": _mb(mail_bytes),
        },
        "mail": {
            "storage_mb": _mb(mail_bytes),
            "domains": 1 if paths["mail"].exists() else 0,
        },
        "resource_limits": {
            "disk_mb": account.disk_mb,
            "bandwidth_mb": account.bandwidth_mb,
            "memory_mb": account.memory_mb,
            "cpu_pct": account.cpu_pct,
        },
        "quota": _quota_usage(account.username),
        "collected_at": timezone.now().isoformat(),
        "warnings": [],
    }


def refresh_local_metrics(accounts=None):
    telemetry = collect_node_telemetry()
    queryset = accounts if accounts is not None else HostingAccount.objects.filter(status=HostingAccount.Status.ACTIVE)
    refreshed = 0
    for account in queryset:
        result = collect_account_usage_local(account)
        from .services import normalize_account_usage

        account.last_usage = normalize_account_usage(account, result)
        account.last_usage_at = timezone.now()
        account.save(update_fields=["last_usage", "last_usage_at", "updated_at"])
        refreshed += 1
    return {"node": telemetry, "accounts_refreshed": refreshed}
