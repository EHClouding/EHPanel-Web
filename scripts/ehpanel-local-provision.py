#!/usr/bin/env python3
import json
import os
import re
import secrets
import shutil
import socket
import ssl
import tarfile
import subprocess
import sys
import time
import urllib.request
from urllib.parse import urlparse
import zipfile
from pathlib import Path

try:
    import grp
    import pwd
except ImportError:
    grp = None
    pwd = None


SAFE_USER = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")
SAFE_DOMAIN = re.compile(r"^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
SAFE_DB = re.compile(r"^[A-Za-z0-9_]{1,64}$")
TEXT_FILE_LIMIT = 2 * 1024 * 1024
DEFAULT_MOODLE_DOWNLOAD_URL = "https://download.moodle.org/download.php/direct/stable502/moodle-latest-502.tgz"


def fail(code, detail, **extra):
    print(json.dumps({"ok": False, "error_code": code, "detail": detail, **extra}))
    return 1


def ok(**extra):
    print(json.dumps({"ok": True, **extra}))
    return 0


def run(args, input_text=None, check=True, cwd=None, env=None):
    runtime_env = None
    if env:
        runtime_env = {**os.environ, **env}
    completed = subprocess.run(args, input=input_text, text=True, capture_output=True, check=False, cwd=cwd, env=runtime_env)
    if check and completed.returncode != 0:
        raise RuntimeError(f"{' '.join(args)} failed: {completed.stderr or completed.stdout}")
    return {"command": args, "returncode": completed.returncode, "stdout": completed.stdout, "stderr": completed.stderr}


def validate_username(username):
    if not SAFE_USER.match(username or ""):
        raise ValueError(f"Usuario invalido: {username}")


def validate_domain(domain):
    domain = str(domain or "").strip().lower().strip(".")
    if not SAFE_DOMAIN.match(domain):
        raise ValueError(f"Dominio invalido: {domain}")
    return domain


def validate_db_name(value, label):
    if not SAFE_DB.match(value or ""):
        raise ValueError(f"{label} invalido: {value}")


def sql_string(value):
    return str(value or "").replace("\\", "\\\\").replace("'", "\\'")


def pg_identifier(value):
    return '"' + str(value).replace('"', '""') + '"'


def pg_literal(value):
    return "'" + str(value or "").replace("'", "''") + "'"


def user_exists(username):
    return subprocess.run(["id", "-u", username], capture_output=True).returncode == 0


def system_user_ids(username="vmail", group="vmail"):
    if pwd is not None and grp is not None:
        try:
            return pwd.getpwnam(username).pw_uid, grp.getgrnam(group).gr_gid
        except KeyError:
            pass
    uid_result = run(["id", "-u", username], check=False)
    gid_result = run(["getent", "group", group], check=False)
    if uid_result["returncode"] == 0 and gid_result["returncode"] == 0:
        group_line = (gid_result.get("stdout") or "").strip()
        group_parts = group_line.split(":")
        if len(group_parts) >= 3:
            return int(uid_result["stdout"].strip()), int(group_parts[2])
    return 1000, 1000


def ensure_user(username, password, home_root):
    validate_username(username)
    home = Path(home_root) / username
    if not user_exists(username):
        run(["useradd", "-m", "-d", str(home), "-s", "/bin/bash", username])
    if password:
        run(["chpasswd"], input_text=f"{username}:{password}\n")
    for folder in [home, home / "public_html", home / "logs", home / "tmp"]:
        folder.mkdir(parents=True, exist_ok=True)
    run(["chown", "-R", f"{username}:{username}", str(home)])
    home.chmod(0o751)
    (home / "public_html").chmod(0o755)
    (home / "logs").chmod(0o755)
    (home / "tmp").chmod(0o700)
    return home


def safe_vhost_name(domain):
    return re.sub(r"[^a-z0-9_.-]", "_", domain.lower())


def account_document_root(username, settings, document_root="public_html"):
    home = (Path(settings["home_root"]) / username).resolve(strict=False)
    relative = str(document_root or "public_html").strip().strip("/").replace("\\", "/")
    if not relative:
        relative = "public_html"
    target = (home / relative).resolve(strict=False)
    if os.path.commonpath([str(home), str(target)]) != str(home):
        raise ValueError("Document root fuera de la cuenta.")
    target.mkdir(parents=True, exist_ok=True)
    return target


def safe_mail_local(local):
    safe_local = re.sub(r"[^a-z0-9_-]", "_", str(local or "").lower())[:32] or "mail"
    validate_username(safe_local)
    return safe_local


def dovecot_passwd_path(settings=None):
    settings = settings or {}
    return Path(settings.get("dovecot_passwd_file") or "/etc/dovecot/ehpanel-users")


def postfix_virtual_domains_path(settings=None):
    settings = settings or {}
    return Path(settings.get("postfix_virtual_domains_file") or "/etc/postfix/ehpanel-virtual-domains")


def postfix_virtual_mailboxes_path(settings=None):
    settings = settings or {}
    return Path(settings.get("postfix_virtual_mailboxes_file") or "/etc/postfix/ehpanel-virtual-mailboxes")


def dovecot_password_hash(password):
    completed = subprocess.run(
        ["doveadm", "pw", "-s", "SHA512-CRYPT", "-p", str(password)],
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(f"No se pudo generar el hash de Dovecot: {detail}")
    hashed = (completed.stdout or "").strip()
    if not hashed:
        raise RuntimeError("Dovecot no devolvio hash de contrasena.")
    return hashed


def write_dovecot_passwd_entry(email, password, home, settings=None):
    if not password:
        return False
    passwd_file = dovecot_passwd_path(settings)
    passwd_file.parent.mkdir(parents=True, exist_ok=True)
    uid, gid = system_user_ids("vmail", "vmail")
    password_hash = dovecot_password_hash(password)
    line = f"{email}:{password_hash}:{uid}:{gid}::{home}::userdb_mail=maildir:~/Maildir"
    update_dovecot_passwd_file(email, passwd_file, line)
    reload_dovecot()
    return True


def remove_dovecot_passwd_entry(email, settings=None):
    passwd_file = dovecot_passwd_path(settings)
    if not passwd_file.exists():
        return False
    changed = update_dovecot_passwd_file(email, passwd_file, None)
    if changed:
        reload_dovecot()
    return changed


def update_dovecot_passwd_file(email, passwd_file, line):
    prefix = f"{email}:"
    existing = []
    if passwd_file.exists():
        existing = passwd_file.read_text(encoding="utf-8", errors="ignore").splitlines()
    next_lines = [item for item in existing if not item.startswith(prefix)]
    if line:
        next_lines.append(line)
    changed = next_lines != existing
    if changed or not passwd_file.exists():
        tmp = passwd_file.with_name(f"{passwd_file.name}.tmp")
        tmp.write_text("\n".join(next_lines) + ("\n" if next_lines else ""), encoding="utf-8")
        tmp.replace(passwd_file)
        run(["chown", "root:dovecot", str(passwd_file)], check=False)
        passwd_file.chmod(0o640)
    return changed


def update_texthash_map(path, key, value=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if path.exists():
        existing = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    key_prefix = f"{key} "
    next_lines = [line for line in existing if line.strip() and not line.startswith(key_prefix)]
    if value is not None:
        next_lines.append(f"{key} {value}")
    changed = next_lines != existing
    if changed or not path.exists():
        tmp = path.with_name(f"{path.name}.tmp")
        tmp.write_text("\n".join(next_lines) + ("\n" if next_lines else ""), encoding="utf-8")
        tmp.replace(path)
        run(["chown", "root:root", str(path)], check=False)
        path.chmod(0o644)
    return changed


def register_postfix_domain(domain, settings=None):
    changed = update_texthash_map(postfix_virtual_domains_path(settings), domain, domain)
    if changed:
        reload_postfix()
    return changed


def register_postfix_mailbox(email, home, settings=None):
    domain = email.split("@", 1)[1]
    relative_maildir = str((Path(domain) / Path(home).name / "Maildir")).replace("\\", "/") + "/"
    changed_domain = update_texthash_map(postfix_virtual_domains_path(settings), domain, domain)
    changed_mailbox = update_texthash_map(postfix_virtual_mailboxes_path(settings), email, relative_maildir)
    if changed_domain or changed_mailbox:
        reload_postfix()
    return changed_domain or changed_mailbox


def remove_postfix_mailbox(email, settings=None):
    changed = update_texthash_map(postfix_virtual_mailboxes_path(settings), email, None)
    if changed:
        reload_postfix()
    return changed


def reload_dovecot():
    result = run(["systemctl", "reload", "dovecot"], check=False)
    if result.get("returncode") != 0:
        run(["systemctl", "restart", "dovecot"], check=False)


def reload_postfix():
    result = run(["systemctl", "reload", "postfix"], check=False)
    if result.get("returncode") != 0:
        run(["systemctl", "restart", "postfix"], check=False)


def restore_selinux_context(path):
    if Path("/usr/sbin/restorecon").exists():
        run(["restorecon", "-R", str(path)], check=False)


def nginx_app_include_line(domain):
    return f"    include /etc/nginx/ehpanel-apps/{safe_vhost_name(domain)}-*.conf;"


def nginx_advanced_include_line(domain):
    return f"    include /etc/nginx/ehpanel-advanced/{safe_vhost_name(domain)}-*.conf;"


def panel_backend(settings):
    return str(settings.get("panel_backend") or "http://127.0.0.1:8004").rstrip("/")


def panel_host_header(settings):
    return str(settings.get("panel_host_header") or "localhost").strip()


def nginx_mail_autoconfig_locations(settings, forwarded_proto="$scheme"):
    backend = panel_backend(settings)
    host_header = panel_host_header(settings)
    common = f"""        proxy_set_header Host {host_header};
        proxy_set_header X-EHPanel-Mail-Config-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto {forwarded_proto};
        proxy_pass {backend};"""
    return f"""    location = /.well-known/autoconfig/mail/config-v1.1.xml {{
{common}
    }}
    location = /mail/config-v1.1.xml {{
{common}
    }}
    location = /mail/mobileconfig/ {{
{common}
    }}
    location = /autodiscover/autodiscover.xml {{
{common}
    }}
"""


def write_nginx_proxy(domain, username, settings, ssl=False, document_root="public_html"):
    nginx_dir = Path(settings["nginx_vhosts_dir"])
    nginx_dir.mkdir(parents=True, exist_ok=True)
    home = Path(settings["home_root"]) / username
    docroot = account_document_root(username, settings, document_root)
    backend = f"http://127.0.0.1:{int(settings['ols_backend_port'])}"
    log_name = safe_vhost_name(domain)
    cert_lines = ""
    listen_ssl = ""
    app_include = nginx_app_include_line(domain)
    if ssl:
        listen_ssl = f"""
server {{
    listen 443 ssl;
    http2 on;
    server_name {domain} www.{domain};
    ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem;
    access_log /var/log/nginx/ehpanel-{log_name}-ssl-access.log;
    error_log /var/log/nginx/ehpanel-{log_name}-ssl-error.log;
    location ^~ /.well-known/acme-challenge/ {{
        alias {docroot}/.well-known/acme-challenge/;
        default_type text/plain;
    }}
{nginx_mail_autoconfig_locations(settings, "https")}
{app_include}
    location / {{
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass {backend};
    }}
}}
"""
    config = f"""server {{
    listen 80;
    server_name {domain} www.{domain};
    access_log /var/log/nginx/ehpanel-{log_name}-access.log;
    error_log /var/log/nginx/ehpanel-{log_name}-error.log;
    location ^~ /.well-known/acme-challenge/ {{
        alias {docroot}/.well-known/acme-challenge/;
        default_type text/plain;
    }}
{nginx_mail_autoconfig_locations(settings)}
{app_include}
    location / {{
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass {backend};
    }}
}}
{listen_ssl}
{cert_lines}
"""
    target = nginx_dir / f"ehpanel-{safe_vhost_name(domain)}.conf"
    target.write_text(config, encoding="utf-8")
    return target


def write_mail_autoconfig_nginx_proxy(domain, username, settings, ssl=False):
    nginx_dir = Path(settings["nginx_vhosts_dir"])
    nginx_dir.mkdir(parents=True, exist_ok=True)
    home = Path(settings["home_root"]) / username
    safe_domain = validate_domain(domain)
    server_names = f"autoconfig.{safe_domain} autodiscover.{safe_domain}"
    log_name = safe_vhost_name(f"mail-autoconfig.{safe_domain}")
    locations_http = nginx_mail_autoconfig_locations(settings)
    locations_https = nginx_mail_autoconfig_locations(settings, "https")
    listen_ssl = ""
    if ssl:
        listen_ssl = f"""
server {{
    listen 443 ssl;
    http2 on;
    server_name {server_names};
    ssl_certificate /etc/letsencrypt/live/{safe_domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{safe_domain}/privkey.pem;
    access_log /var/log/nginx/ehpanel-{log_name}-ssl-access.log;
    error_log /var/log/nginx/ehpanel-{log_name}-ssl-error.log;
    location ^~ /.well-known/acme-challenge/ {{
        alias {home}/public_html/.well-known/acme-challenge/;
        default_type text/plain;
    }}
{locations_https}
    location / {{
        return 404;
    }}
}}
"""
    config = f"""server {{
    listen 80;
    server_name {server_names};
    access_log /var/log/nginx/ehpanel-{log_name}-access.log;
    error_log /var/log/nginx/ehpanel-{log_name}-error.log;
    location ^~ /.well-known/acme-challenge/ {{
        alias {home}/public_html/.well-known/acme-challenge/;
        default_type text/plain;
    }}
{locations_http}
    location / {{
        return 404;
    }}
}}
{listen_ssl}
"""
    target = nginx_dir / f"ehpanel-mail-autoconfig-{safe_vhost_name(safe_domain)}.conf"
    target.write_text(config, encoding="utf-8")
    return target


def ensure_nginx_app_include(domain, settings):
    target = Path(settings["nginx_vhosts_dir"]) / f"ehpanel-{safe_vhost_name(domain)}.conf"
    include_line = nginx_app_include_line(domain)
    if not target.exists():
        return False
    text = target.read_text(encoding="utf-8", errors="ignore")
    if include_line.strip() in text:
        return False
    updated = text.replace("    location / {", f"{include_line}\n    location / {{")
    if updated != text:
        target.write_text(updated, encoding="utf-8")
        return True
    return False


def ensure_nginx_advanced_include(domain, settings):
    target = Path(settings["nginx_vhosts_dir"]) / f"ehpanel-{safe_vhost_name(domain)}.conf"
    include_line = nginx_advanced_include_line(domain)
    if not target.exists():
        return False
    text = target.read_text(encoding="utf-8", errors="ignore")
    if include_line.strip() in text:
        return False
    updated = text.replace("    location / {", f"{include_line}\n    location / {{")
    if updated != text:
        target.write_text(updated, encoding="utf-8")
        return True
    return False


def write_webmail_nginx_proxy(domain, username, settings, ssl=False):
    if not settings.get("webmail_enabled", True):
        return None
    nginx_dir = Path(settings["nginx_vhosts_dir"])
    nginx_dir.mkdir(parents=True, exist_ok=True)
    home = Path(settings["home_root"]) / username
    webmail_domain = f"webmail.{validate_domain(domain)}"
    webmail_root = Path(settings.get("webmail_root") or "/opt/ehpanel-webmail") / "frontend" / "dist"
    backend = f"http://127.0.0.1:{int(settings.get('webmail_port') or 8012)}"
    log_name = safe_vhost_name(webmail_domain)
    listen_ssl = ""
    if ssl:
        listen_ssl = f"""
server {{
    listen 443 ssl;
    http2 on;
    server_name {webmail_domain};
    ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem;
    client_max_body_size 1024m;
    root {webmail_root};
    index index.html;
    access_log /var/log/nginx/ehpanel-{log_name}-ssl-access.log;
    error_log /var/log/nginx/ehpanel-{log_name}-ssl-error.log;
    location ^~ /.well-known/acme-challenge/ {{
        alias {home}/public_html/.well-known/acme-challenge/;
        default_type text/plain;
    }}
    location /api/ {{
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass {backend};
    }}
    location /health/ {{
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass {backend};
    }}
    location / {{
        try_files $uri /index.html;
    }}
}}
"""
    config = f"""server {{
    listen 80;
    server_name {webmail_domain};
    client_max_body_size 1024m;
    root {webmail_root};
    index index.html;
    access_log /var/log/nginx/ehpanel-{log_name}-access.log;
    error_log /var/log/nginx/ehpanel-{log_name}-error.log;
    location ^~ /.well-known/acme-challenge/ {{
        alias {home}/public_html/.well-known/acme-challenge/;
        default_type text/plain;
    }}
    location /api/ {{
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass {backend};
    }}
    location /health/ {{
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass {backend};
    }}
    location / {{
        try_files $uri /index.html;
    }}
}}
{listen_ssl}
"""
    target = nginx_dir / f"ehpanel-{safe_vhost_name(webmail_domain)}.conf"
    target.write_text(config, encoding="utf-8")
    return target


def ols_php_handler(version, settings):
    digits = re.sub(r"[^0-9]", "", str(version or ""))
    short = digits[:2] if len(digits) >= 2 else "83"
    php_path = Path(f"/usr/local/lsws/lsphp{short}/bin/lsphp")
    if not php_path.exists():
        php_path = Path("/usr/local/lsws/lsphp83/bin/lsphp")
        short = "83"
    handler = f"lsphp{short}"
    httpd_config = Path(settings["ols_home"]) / "conf" / "httpd_config.conf"
    if not httpd_config.exists():
        return "lsphp"
    text = httpd_config.read_text(encoding="utf-8", errors="ignore")
    if f"extProcessor {handler}" not in text:
        block = f"""
extProcessor {handler}{{
    type                            lsapi
    address                         uds://tmp/lshttpd/{handler}.sock
    maxConns                        10
    env                             PHP_LSAPI_CHILDREN=10
    env                             LSAPI_AVOID_FORK=200M
    initTimeout                     60
    retryTimeout                    0
    persistConn                     1
    pcKeepAliveTimeout
    respBuffer                      0
    autoStart                       1
    path                            {php_path}
    backlog                         100
    instances                       1
    priority                        0
    memSoftLimit                    0
    memHardLimit                    0
    procSoftLimit                   1400
    procHardLimit                   1500
}}
"""
        marker = "scriptHandler{"
        if marker in text:
            text = text.replace(marker, block + "\n" + marker, 1)
        else:
            text += block
        httpd_config.write_text(text, encoding="utf-8")
    return handler


def write_ols_vhost(domain, username, settings, document_root="public_html"):
    ols_home = Path(settings["ols_home"])
    vhost = safe_vhost_name(domain)
    vhost_dir = ols_home / "conf" / "vhosts" / vhost
    vhost_dir.mkdir(parents=True, exist_ok=True)
    docroot = account_document_root(username, settings, document_root)
    handler_name = ols_php_handler(settings.get("php_version") or "8.3", settings)
    vhconf = f"""docRoot                   {docroot}
vhDomain                  {domain}
vhAliases                 www.{domain}
adminEmails               admin@{domain}
enableGzip                1
enableIpGeo               0

index  {{
  useServer               0
  indexFiles              index.php,index.html,index.htm
}}

context / {{
  location                {docroot}
  allowBrowse             1
}}

scripthandler  {{
  add                     lsapi:{handler_name} php
}}
"""
    (vhost_dir / "vhconf.conf").write_text(vhconf, encoding="utf-8")
    httpd_config = ols_home / "conf" / "httpd_config.conf"
    if httpd_config.exists():
        text = httpd_config.read_text(encoding="utf-8", errors="ignore")
        marker = f"virtualhost {vhost} {{"
        if marker not in text:
            text += f"""

virtualhost {vhost} {{
  vhRoot                  {vhost_dir}
  configFile              {vhost_dir}/vhconf.conf
  allowSymbolLink         1
  enableScript            1
  restrained              1
}}
"""
        map_line = f"  map                     {vhost} {domain},www.{domain}"
        if map_line not in text:
            listener_match = re.search(r"(listener\s+Default\s*\{[^}]*)(\})", text, re.IGNORECASE | re.DOTALL)
            if listener_match:
                text = text[: listener_match.start(2)] + map_line + "\n" + text[listener_match.start(2) :]
            else:
                text += f"""

listener Default {{
  address                 *:{int(settings['ols_backend_port'])}
{map_line}
}}
"""
        httpd_config.write_text(text, encoding="utf-8")
    return vhost_dir


def pdns_record_name(zone, name):
    name = str(name or "@").strip().strip(".")
    if name == "@":
        return zone
    if name.endswith(f".{zone}"):
        return name
    return f"{name}.{zone}"


def dns_has_public_answer(domain):
    try:
        socket.getaddrinfo(domain, 80, type=socket.SOCK_STREAM)
        return True
    except socket.gaierror:
        return False


def provision_hosting(payload, settings):
    username = payload["username"]
    domain = validate_domain(payload["domain"])
    document_root = payload.get("document_root") or "public_html"
    settings = {**settings, "php_version": payload.get("php_version") or settings.get("php_version") or ""}
    home = ensure_user(username, payload.get("password", ""), settings["home_root"])
    if payload.get("write_default_index", True):
        index = account_document_root(username, settings, document_root) / "index.html"
        if not index.exists():
            index.write_text(f"<h1>{domain}</h1>\n<p>EHPanel Web</p>\n", encoding="utf-8")
            run(["chown", f"{username}:{username}", str(index)])
    nginx_conf = write_nginx_proxy(domain, username, settings, document_root=document_root)
    mail_autoconfig_conf = write_mail_autoconfig_nginx_proxy(domain, username, settings)
    webmail_conf = write_webmail_nginx_proxy(domain, username, settings)
    ols_vhost = write_ols_vhost(domain, username, settings, document_root=document_root)
    checks = [run(["nginx", "-t"])]
    run(["systemctl", "reload", "nginx"], check=False)
    run(["systemctl", "restart", "lshttpd"], check=False)
    return ok(
        home=str(home),
        nginx_conf=str(nginx_conf),
        mail_autoconfig_conf=str(mail_autoconfig_conf),
        webmail_conf=str(webmail_conf) if webmail_conf else "",
        ols_vhost=str(ols_vhost),
        checks=checks,
    )


def create_dns_zone(payload, settings):
    if not settings.get("provision_dns", True):
        return ok(skipped=True, reason="dns_disabled")
    if not shutil.which("pdnsutil"):
        return fail("PDNSUTIL_NOT_FOUND", "pdnsutil no esta instalado.")
    zone = validate_domain(payload["zone"])
    run(["pdnsutil", "create-zone", zone, payload.get("nameserver") or f"ns1.{zone}"], check=False)
    applied = []
    errors = []
    for record in payload.get("records") or []:
        name = str(record.get("name") or "@")
        rtype = str(record.get("type") or record.get("record_type") or "A").upper()
        content = str(record.get("value") or record.get("content") or "")
        ttl = str(int(record.get("ttl") or 300))
        if content:
            fqdn = pdns_record_name(zone, name)
            result = run(["pdnsutil", "rrset", "replace", zone, fqdn, rtype, ttl, content], check=False)
            if result["returncode"] != 0:
                result = run(["pdnsutil", "replace-rrset", zone, fqdn, rtype, ttl, content], check=False)
            if result["returncode"] == 0:
                applied.append({"name": fqdn, "type": rtype})
            else:
                errors.append({"name": fqdn, "type": rtype, "stderr": result.get("stderr") or result.get("stdout")})
    if errors:
        raise RuntimeError(f"No se pudieron aplicar registros DNS: {errors[:3]}")
    run(["pdns_control", "reload"], check=False)
    return ok(zone=zone, applied=applied)


def issue_ssl(payload, settings):
    if not settings.get("provision_ssl", True):
        return ok(skipped=True, reason="ssl_disabled")
    if not shutil.which("certbot"):
        return fail("CERTBOT_NOT_FOUND", "certbot no esta instalado.")
    domain = validate_domain(payload["domain"])
    username = payload["username"]
    webroot = str(account_document_root(username, settings, payload.get("document_root") or "public_html"))
    if not dns_has_public_answer(domain):
        return fail("SSL_DNS_NOT_FOUND", f"El dominio {domain} no tiene DNS publico A/AAAA para emitir SSL.")
    requested_aliases = []
    skipped_aliases = []
    for alias in payload.get("aliases") or []:
        alias_domain = validate_domain(alias)
        if alias_domain == domain or alias_domain in requested_aliases:
            continue
        if dns_has_public_answer(alias_domain):
            requested_aliases.append(alias_domain)
        else:
            skipped_aliases.append({"domain": alias_domain, "reason": "dns_not_found"})
    args = ["certbot", "certonly", "--webroot", "-w", webroot, "-d", domain, "--noninteractive", "--agree-tos", "--email", payload.get("email") or f"admin@{domain}"]
    for alias in requested_aliases:
        args.extend(["-d", alias])
    if payload.get("staging"):
        args.append("--staging")
    if payload.get("force_renewal"):
        args.append("--force-renewal")
    result = run(args, check=True)
    write_nginx_proxy(domain, username, settings, ssl=True, document_root=payload.get("document_root") or "public_html")
    write_mail_autoconfig_nginx_proxy(domain, username, settings, ssl=True)
    write_webmail_nginx_proxy(domain, username, settings, ssl=True)
    run(["nginx", "-t"])
    run(["systemctl", "reload", "nginx"], check=False)
    cert_dir = Path("/etc/letsencrypt/live") / domain
    fullchain = cert_dir / "fullchain.pem"
    not_after = ""
    dns_names = [domain, *requested_aliases]
    if fullchain.exists():
        expiry = run(["openssl", "x509", "-enddate", "-noout", "-in", str(fullchain)], check=False)
        match = re.search(r"notAfter=(.+)", expiry.get("stdout") or "")
        not_after = match.group(1).strip() if match else ""
    return ok(
        domain=domain,
        aliases=dns_names[1:],
        dns_names=dns_names,
        skipped_aliases=skipped_aliases,
        cert=str(fullchain),
        privkey=str(cert_dir / "privkey.pem"),
        not_after=not_after,
        result=result,
    )


def create_postgresql_database(database, username, password):
    validate_db_name(database, "Base de datos")
    validate_db_name(username, "Usuario de base de datos")
    psql_base = ["runuser", "-u", "postgres", "--", "psql", "-v", "ON_ERROR_STOP=1"]
    role_exists = run(
        ["runuser", "-u", "postgres", "--", "psql", "-tAc", f"SELECT 1 FROM pg_roles WHERE rolname = {pg_literal(username)}"],
        check=False,
    )
    if "1" in (role_exists.get("stdout") or ""):
        run(psql_base + ["-c", f"ALTER ROLE {pg_identifier(username)} WITH LOGIN PASSWORD {pg_literal(password)};"])
    else:
        run(psql_base + ["-c", f"CREATE ROLE {pg_identifier(username)} WITH LOGIN PASSWORD {pg_literal(password)};"])
    db_exists = run(
        ["runuser", "-u", "postgres", "--", "psql", "-tAc", f"SELECT 1 FROM pg_database WHERE datname = {pg_literal(database)}"],
        check=False,
    )
    if "1" not in (db_exists.get("stdout") or ""):
        run(psql_base + ["-c", f"CREATE DATABASE {pg_identifier(database)} OWNER {pg_identifier(username)} ENCODING 'UTF8';"])
    run(psql_base + ["-c", f"GRANT ALL PRIVILEGES ON DATABASE {pg_identifier(database)} TO {pg_identifier(username)};"])
    run(psql_base + ["-d", database, "-c", f"ALTER SCHEMA public OWNER TO {pg_identifier(username)};"], check=False)
    run(psql_base + ["-d", database, "-c", f"GRANT ALL ON SCHEMA public TO {pg_identifier(username)};"], check=False)


def create_database(payload, emit=True):
    database = payload.get("database") or payload.get("name")
    username = payload.get("username") or payload.get("user")
    password = payload.get("password") or payload.get("database_password")
    engine = str(payload.get("engine") or "mariadb").lower()
    validate_db_name(database, "Base de datos")
    validate_db_name(username, "Usuario de base de datos")
    if engine == "postgresql":
        create_postgresql_database(database, username, password)
        return ok(engine=engine, database=database, username=username) if emit else {"engine": engine, "database": database, "username": username}
    sql = (
        f"CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        f"CREATE USER IF NOT EXISTS '{username}'@'localhost' IDENTIFIED BY '{sql_string(password)}';"
        f"GRANT ALL PRIVILEGES ON `{database}`.* TO '{username}'@'localhost';"
        "FLUSH PRIVILEGES;"
    )
    run(["mysql", "-e", sql])
    return ok(engine="mariadb", database=database, username=username) if emit else {"engine": "mariadb", "database": database, "username": username}


SAFE_INSTANCE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,80}$")


def validate_instance_id(instance_id):
    value = str(instance_id or "").strip()
    if not SAFE_INSTANCE.match(value):
        raise ValueError(f"Instance id invalido: {instance_id}")
    return value


def safe_app_dir(payload, settings):
    username = payload["username"]
    validate_username(username)
    home = (Path(settings["home_root"]) / username).resolve(strict=False)
    working_dir = str(payload.get("working_dir") or f"apps/{payload.get('instance_id') or payload.get('name') or 'app'}").strip().strip("/").replace("\\", "/")
    target = (home / working_dir).resolve(strict=False)
    if os.path.commonpath([str(home), str(target)]) != str(home):
        raise ValueError("Ruta de aplicacion fuera de la cuenta.")
    target.mkdir(parents=True, exist_ok=True)
    return home, target


def safe_existing_path(path, username=None, settings=None):
    target = Path(path).resolve(strict=False)
    if username and settings:
        home = (Path(settings["home_root"]) / username).resolve(strict=False)
        if os.path.commonpath([str(home), str(target)]) != str(home):
            raise ValueError("Ruta fuera de la cuenta.")
    return target


def chown_account(username, path):
    run(["chown", "-R", f"{username}:{username}", str(path)], check=False)


def write_app_proxy(domain, instance_id, port, settings):
    domain = validate_domain(domain)
    instance_id = validate_instance_id(instance_id)
    port = int(port)
    apps_dir = Path("/etc/nginx/ehpanel-apps")
    apps_dir.mkdir(parents=True, exist_ok=True)
    conf = apps_dir / f"{safe_vhost_name(domain)}-{safe_vhost_name(instance_id)}.conf"
    conf.write_text(
        f"""location ^~ /__apps/{instance_id}/ {{
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Prefix /__apps/{instance_id};
    proxy_pass http://127.0.0.1:{port}/;
}}
""",
        encoding="utf-8",
    )
    ensure_nginx_app_include(domain, settings)
    run(["nginx", "-t"])
    run(["systemctl", "reload", "nginx"], check=False)
    return conf


def public_url(payload, domain, path=""):
    scheme = "https" if payload.get("ssl_active") else "http"
    return f"{scheme}://{domain}{path}"


def app_path(payload, settings):
    path = payload.get("path") or payload.get("working_dir") or ""
    if path:
        target = Path(path)
        if not target.is_absolute():
            target = Path(settings["home_root"]) / payload["username"] / str(path).strip("/")
        return safe_existing_path(target, payload["username"], settings)
    _, target = safe_app_dir(payload, settings)
    return target


def app_service_name(instance_id):
    return "ehpanel-app-" + re.sub(r"[^A-Za-z0-9_.-]", "-", validate_instance_id(instance_id)).lower()


def write_systemd_app_service(username, instance_id, app_dir, start_script, description):
    service = app_service_name(instance_id)
    unit = Path("/etc/systemd/system") / f"{service}.service"
    unit.write_text(
        f"""[Unit]
Description={description}
After=network.target

[Service]
Type=simple
User={username}
Group={username}
WorkingDirectory={app_dir}
ExecStart=/bin/sh {start_script}
Restart=always
RestartSec=5
Environment=HOME={Path(app_dir).parent}

[Install]
WantedBy=multi-user.target
""",
        encoding="utf-8",
    )
    run(["systemctl", "daemon-reload"])
    run(["systemctl", "enable", "--now", service])
    time.sleep(1)
    active = run(["systemctl", "is-active", service], check=False)
    if active.get("returncode") != 0:
        logs = command_stdout(["journalctl", "-u", service, "-n", "20", "--no-pager"])
        raise RuntimeError(f"Servicio {service} no inicio: {(active.get('stdout') or active.get('stderr') or '').strip()} {logs}")
    return service


def download_file(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as response:
        target.write_bytes(response.read())
    return target


def ensure_wp_cli():
    wp = shutil.which("wp")
    if wp:
        return wp
    target = Path("/usr/local/bin/wp")
    download_file("https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar", target)
    target.chmod(0o755)
    return str(target)


def wordpress_salts():
    keys = [
        "AUTH_KEY",
        "SECURE_AUTH_KEY",
        "LOGGED_IN_KEY",
        "NONCE_KEY",
        "AUTH_SALT",
        "SECURE_AUTH_SALT",
        "LOGGED_IN_SALT",
        "NONCE_SALT",
    ]
    return "\n".join(f"define('{key}', '{secrets.token_urlsafe(48)}');" for key in keys)


def php_single_quoted(value):
    return str(value or "").replace("\\", "\\\\").replace("'", "\\'")


def install_wordpress_app(payload, settings):
    username = payload["username"]
    validate_username(username)
    domain = validate_domain(payload["domain"])
    _, app_dir = safe_app_dir({**payload, "working_dir": payload.get("working_dir") or payload.get("document_root") or "public_html"}, settings)
    if payload.get("force"):
        for item in app_dir.iterdir():
            if item.name not in {".well-known"}:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
    create_database({"engine": "mariadb", "database": payload["database"], "user": payload["db_user"], "password": payload["db_password"]}, emit=False)
    if not (app_dir / "wp-settings.php").exists():
        archive = Path("/tmp") / f"wordpress-{secrets.token_hex(6)}.tar.gz"
        download_file("https://wordpress.org/latest.tar.gz", archive)
        with tarfile.open(archive, "r:gz") as tar:
            for member in tar.getmembers():
                if not member.name.startswith("wordpress/") or member.name == "wordpress/":
                    continue
                member.name = member.name[len("wordpress/") :]
                target = (app_dir / member.name).resolve(strict=False)
                if os.path.commonpath([str(app_dir.resolve(strict=False)), str(target)]) == str(app_dir.resolve(strict=False)):
                    tar.extract(member, app_dir)
        archive.unlink(missing_ok=True)
    config = app_dir / "wp-config.php"
    table_prefix = re.sub(r"[^A-Za-z0-9_]", "_", payload.get("table_prefix") or "wp_")[:32] or "wp_"
    config.write_text(
        f"""<?php
define('DB_NAME', '{sql_string(payload["database"])}');
define('DB_USER', '{sql_string(payload["db_user"])}');
define('DB_PASSWORD', '{sql_string(payload["db_password"])}');
define('DB_HOST', 'localhost');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');
{wordpress_salts()}
$table_prefix = '{table_prefix}';
define('WP_DEBUG', false);
if (!defined('ABSPATH')) {{
    define('ABSPATH', __DIR__ . '/');
}}
require_once ABSPATH . 'wp-settings.php';
""",
        encoding="utf-8",
    )
    chown_account(username, app_dir)
    wp = ensure_wp_cli()
    php = php_binary(payload.get("php_version") or settings.get("php_version") or "8.3")
    wp_args = [
        "runuser",
        "-u",
        username,
        "--",
        php,
        wp,
        "core",
        "install",
        "--path=" + str(app_dir),
        "--url=" + public_url(payload, domain),
        "--title=" + str(payload.get("site_title") or "WordPress"),
        "--admin_user=" + str(payload["admin_user"]),
        "--admin_password=" + str(payload["admin_password"]),
        "--admin_email=" + str(payload["admin_email"]),
        "--skip-email",
    ]
    if payload.get("language"):
        wp_args.append("--locale=" + str(payload["language"]))
    install_result = run(wp_args, check=False)
    version_result = run(["runuser", "-u", username, "--", php, wp, "core", "version", "--path=" + str(app_dir)], check=False)
    wp_version = (version_result.get("stdout") or "").strip()
    return ok(
        app_id=payload.get("app_id"),
        url=public_url(payload, domain),
        install_path=str(app_dir),
        wp_version=wp_version,
        wp_cli_install_returncode=install_result.get("returncode"),
        wp_cli_output=(install_result.get("stdout") or install_result.get("stderr") or "").strip()[-1000:],
    )


def safe_moodledata_dir(payload, settings, username, domain):
    home = (Path(settings["home_root"]) / username).resolve(strict=False)
    requested = payload.get("moodledata_path") or (home / "moodledata" / domain)
    target = Path(str(requested))
    if not target.is_absolute():
        target = home / str(requested).strip("/")
    target = target.resolve(strict=False)
    if os.path.commonpath([str(home), str(target)]) != str(home):
        raise ValueError("Ruta moodledata fuera de la cuenta.")
    target.mkdir(parents=True, exist_ok=True)
    return target


def install_moodle_app(payload, settings):
    username = payload["username"]
    validate_username(username)
    domain = validate_domain(payload["domain"])
    _, app_dir = safe_app_dir({**payload, "working_dir": payload.get("working_dir") or payload.get("document_root") or "public_html"}, settings)
    moodledata = safe_moodledata_dir(payload, settings, username, domain)
    if payload.get("force"):
        for item in app_dir.iterdir():
            if item.name not in {".well-known"}:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
        for item in moodledata.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
    create_database({"engine": "mariadb", "database": payload["database"], "user": payload["db_user"], "password": payload["db_password"]}, emit=False)
    source_url = str(payload.get("source_url") or settings.get("moodle_download_url") or DEFAULT_MOODLE_DOWNLOAD_URL)
    if not (app_dir / "version.php").exists():
        archive = Path("/tmp") / f"moodle-{secrets.token_hex(6)}.tgz"
        download_file(source_url, archive)
        with tarfile.open(archive, "r:gz") as tar:
            for member in tar.getmembers():
                if not member.name.startswith("moodle/") or member.name == "moodle/":
                    continue
                member.name = member.name[len("moodle/") :]
                target = (app_dir / member.name).resolve(strict=False)
                if os.path.commonpath([str(app_dir.resolve(strict=False)), str(target)]) == str(app_dir.resolve(strict=False)):
                    tar.extract(member, app_dir)
        archive.unlink(missing_ok=True)
    table_prefix = re.sub(r"[^A-Za-z0-9_]", "_", payload.get("table_prefix") or "mdl_")[:20] or "mdl_"
    if not table_prefix.endswith("_"):
        table_prefix += "_"
    config = app_dir / "config.php"
    config.write_text(
        f"""<?php
unset($CFG);
global $CFG;
$CFG = new stdClass();
$CFG->dbtype = 'mysqli';
$CFG->dblibrary = 'native';
$CFG->dbhost = 'localhost';
$CFG->dbname = '{php_single_quoted(payload["database"])}';
$CFG->dbuser = '{php_single_quoted(payload["db_user"])}';
$CFG->dbpass = '{php_single_quoted(payload["db_password"])}';
$CFG->prefix = '{php_single_quoted(table_prefix)}';
$CFG->dboptions = array(
    'dbpersist' => false,
    'dbport' => '',
    'dbsocket' => '',
    'dbcollation' => 'utf8mb4_unicode_ci',
);
$CFG->wwwroot = '{php_single_quoted(public_url(payload, domain))}';
$CFG->dataroot = '{php_single_quoted(str(moodledata))}';
$CFG->admin = 'admin';
$CFG->directorypermissions = 02775;
require_once(__DIR__ . '/lib/setup.php');
""",
        encoding="utf-8",
    )
    chown_account(username, app_dir)
    chown_account(username, moodledata)
    php = php_binary(payload.get("php_version") or settings.get("php_version") or "8.3")
    install_result = run(
        [
            "runuser",
            "-u",
            username,
            "--",
            php,
            str(app_dir / "admin" / "cli" / "install_database.php"),
            "--agree-license",
            "--non-interactive",
            "--adminuser=" + str(payload["admin_user"]),
            "--adminpass=" + str(payload["admin_password"]),
            "--adminemail=" + str(payload["admin_email"]),
            "--fullname=" + str(payload.get("site_title") or "Moodle"),
            "--shortname=" + str(payload.get("site_shortname") or domain.split(".")[0] or "moodle"),
            "--lang=" + str(payload.get("language") or "es"),
        ],
        check=False,
        cwd=str(app_dir),
    )
    if install_result.get("returncode") != 0:
        raise RuntimeError((install_result.get("stderr") or install_result.get("stdout") or "No se pudo instalar Moodle").strip())
    cron_name = "ehpanel-moodle-" + re.sub(r"[^A-Za-z0-9_.-]", "-", f"{username}-{domain}")[:80]
    cron_file = Path("/etc/cron.d") / cron_name
    cron_file.write_text(f"*/5 * * * * {username} {php} {app_dir}/admin/cli/cron.php >/dev/null 2>&1\n", encoding="utf-8")
    cron_file.chmod(0o644)
    version_text = (app_dir / "version.php").read_text(encoding="utf-8", errors="ignore") if (app_dir / "version.php").exists() else ""
    release_match = re.search(r"\$release\s*=\s*'([^']+)'", version_text)
    return ok(
        app_id=payload.get("app_id"),
        url=public_url(payload, domain),
        install_path=str(app_dir),
        moodledata_path=str(moodledata),
        cron_file=str(cron_file),
        source_url=source_url,
        moodle_version=release_match.group(1) if release_match else "",
        php_version=command_stdout([php, "-r", "echo PHP_VERSION;"]),
    )


def deploy_node_app(payload, settings):
    username = payload["username"]
    validate_username(username)
    domain = validate_domain(payload["domain"])
    instance_id = validate_instance_id(payload["instance_id"])
    port = int(payload["port"])
    _, app_dir = safe_app_dir(payload, settings)
    script = str(payload.get("script") or "server.js").strip().strip("/") or "server.js"
    server = app_dir / script
    if not server.exists():
        server.write_text(
            f"""const http = require('http');
const port = process.env.PORT || {port};
http.createServer((req, res) => {{
  res.writeHead(200, {{'Content-Type': 'text/plain; charset=utf-8'}});
  res.end('EHPanel Node.js app {instance_id}\\n');
}}).listen(port, '127.0.0.1');
""",
            encoding="utf-8",
        )
    package_json = app_dir / "package.json"
    if not package_json.exists():
        package_json.write_text(json.dumps({"name": instance_id.lower(), "version": "1.0.0", "scripts": {"start": f"node {script}"}}, indent=2), encoding="utf-8")
    start_script = app_dir / ".ehpanel-start-node.sh"
    node_bin = shutil.which("node") or "/usr/bin/node"
    start_script.write_text(f"#!/bin/sh\nexport PORT={port}\nexec {node_bin} {server}\n", encoding="utf-8")
    start_script.chmod(0o755)
    chown_account(username, app_dir)
    service = write_systemd_app_service(username, instance_id, app_dir, start_script, f"EHPanel Node app {instance_id}")
    proxy = write_app_proxy(domain, instance_id, port, settings)
    return ok(app_id=payload.get("app_id"), url=public_url(payload, domain, f"/__apps/{instance_id}/"), install_path=str(app_dir), service=service, proxy=str(proxy), node_version=command_stdout([node_bin, "--version"]))


def deploy_django_app(payload, settings):
    username = payload["username"]
    validate_username(username)
    domain = validate_domain(payload["domain"])
    instance_id = validate_instance_id(payload["instance_id"])
    port = int(payload["port"])
    project_module = re.sub(r"[^A-Za-z0-9_]", "_", payload.get("project_module") or "ehpanelapp") or "ehpanelapp"
    _, app_dir = safe_app_dir(payload, settings)
    if payload.get("database") and payload.get("db_user") and payload.get("db_password"):
        create_database({"engine": payload.get("database_engine") or "postgresql", "database": payload["database"], "user": payload["db_user"], "password": payload["db_password"]}, emit=False)
    venv = app_dir / ".venv"
    if not (venv / "bin" / "python").exists():
        run(["python3", "-m", "venv", str(venv)])
    pip = str(venv / "bin" / "pip")
    django_spec = "django"
    if payload.get("django_version"):
        django_spec = f"django=={re.sub(r'[^0-9A-Za-z.*<>=!~,.-]', '', str(payload['django_version']))}"
    run([pip, "install", "--upgrade", "pip", "wheel"], cwd=str(app_dir))
    run([pip, "install", django_spec, "gunicorn"], cwd=str(app_dir))
    django_admin = str(venv / "bin" / "django-admin")
    if not (app_dir / project_module / "settings.py").exists():
        run([django_admin, "startproject", project_module, "."], cwd=str(app_dir))
        settings_file = app_dir / project_module / "settings.py"
        text = settings_file.read_text(encoding="utf-8")
        text = text.replace("ALLOWED_HOSTS = []", f"ALLOWED_HOSTS = ['{domain}', 'www.{domain}', '127.0.0.1', 'localhost']")
        settings_file.write_text(text, encoding="utf-8")
    start_script = app_dir / ".ehpanel-start-django.sh"
    gunicorn = str(venv / "bin" / "gunicorn")
    workers = int(payload.get("workers") or 2)
    start_script.write_text(f"#!/bin/sh\nexec {gunicorn} {project_module}.wsgi:application --bind 127.0.0.1:{port} --workers {workers}\n", encoding="utf-8")
    start_script.chmod(0o755)
    chown_account(username, app_dir)
    service = write_systemd_app_service(username, instance_id, app_dir, start_script, f"EHPanel Django app {instance_id}")
    proxy = write_app_proxy(domain, instance_id, port, settings)
    django_version = command_stdout([str(venv / "bin" / "python"), "-m", "django", "--version"])
    return ok(app_id=payload.get("app_id"), url=public_url(payload, domain, f"/__apps/{instance_id}/"), install_path=str(app_dir), service=service, proxy=str(proxy), django_version=django_version)


def ensure_composer():
    composer = shutil.which("composer")
    if composer:
        return composer
    installer = Path("/tmp") / f"composer-{secrets.token_hex(6)}.php"
    download_file("https://getcomposer.org/installer", installer)
    php = php_binary("8.3")
    run([php, str(installer), "--install-dir=/usr/local/bin", "--filename=composer"])
    installer.unlink(missing_ok=True)
    return "/usr/local/bin/composer"


def deploy_laravel_app(payload, settings):
    username = payload["username"]
    validate_username(username)
    domain = validate_domain(payload["domain"])
    instance_id = validate_instance_id(payload["instance_id"])
    port = int(payload["port"])
    _, app_dir = safe_app_dir(payload, settings)
    if payload.get("database") and payload.get("db_user") and payload.get("db_password"):
        create_database({"engine": payload.get("database_engine") or "mariadb", "database": payload["database"], "user": payload["db_user"], "password": payload["db_password"]}, emit=False)
    composer = ensure_composer()
    php = php_binary(payload.get("php_version") or settings.get("php_version") or "8.3")
    if not (app_dir / "artisan").exists():
        parent = app_dir.parent
        tmp_name = app_dir.name + ".new"
        tmp_dir = parent / tmp_name
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)
        run([composer, "create-project", "laravel/laravel", tmp_name, "--no-interaction"], cwd=str(parent), env={"COMPOSER_ALLOW_SUPERUSER": "1"})
        if app_dir.exists() and any(app_dir.iterdir()):
            for item in tmp_dir.iterdir():
                target = app_dir / item.name
                if target.exists():
                    if target.is_dir():
                        shutil.rmtree(target)
                    else:
                        target.unlink()
                shutil.move(str(item), str(target))
            shutil.rmtree(tmp_dir)
        else:
            if app_dir.exists():
                app_dir.rmdir()
            tmp_dir.rename(app_dir)
    if not (app_dir / "artisan").exists():
        raise RuntimeError(f"Laravel no quedo instalado correctamente en {app_dir}: falta artisan.")
    env_file = app_dir / ".env"
    if env_file.exists() and payload.get("database"):
        text = env_file.read_text(encoding="utf-8", errors="ignore")
        text = re.sub(r"^DB_CONNECTION=.*$", "DB_CONNECTION=mysql", text, flags=re.MULTILINE)
        text = re.sub(r"^DB_DATABASE=.*$", f"DB_DATABASE={payload['database']}", text, flags=re.MULTILINE)
        text = re.sub(r"^DB_USERNAME=.*$", f"DB_USERNAME={payload['db_user']}", text, flags=re.MULTILINE)
        text = re.sub(r"^DB_PASSWORD=.*$", f"DB_PASSWORD={payload['db_password']}", text, flags=re.MULTILINE)
        env_file.write_text(text, encoding="utf-8")
    run([php, "artisan", "key:generate", "--force", "--no-interaction"], cwd=str(app_dir), check=False)
    start_script = app_dir / ".ehpanel-start-laravel.sh"
    start_script.write_text(f"#!/bin/sh\nexec {php} artisan serve --host=127.0.0.1 --port={port}\n", encoding="utf-8")
    start_script.chmod(0o755)
    chown_account(username, app_dir)
    service = write_systemd_app_service(username, instance_id, app_dir, start_script, f"EHPanel Laravel app {instance_id}")
    proxy = write_app_proxy(domain, instance_id, port, settings)
    version_result = run([php, "artisan", "--version"], cwd=str(app_dir), check=False)
    laravel_version = (version_result.get("stdout") or version_result.get("stderr") or "").strip()
    return ok(app_id=payload.get("app_id"), url=public_url(payload, domain, f"/__apps/{instance_id}/"), install_path=str(app_dir), service=service, proxy=str(proxy), php_version=command_stdout([php, "-r", "echo PHP_VERSION;"]), laravel_version=laravel_version)


def service_for_instance(instance_id):
    service = app_service_name(instance_id)
    state = run(["systemctl", "is-active", service], check=False)
    return service, (state.get("stdout") or state.get("stderr") or "unknown").strip()


def read_json_file(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return {}


def wordpress_toolkit(payload, settings):
    username = payload["username"]
    validate_username(username)
    path = app_path(payload, settings)
    action = str(payload.get("action") or "summary")
    php = php_binary(payload.get("php_version") or settings.get("php_version") or "8.3")
    wp = ensure_wp_cli()

    def wp_cmd(*args, check=False):
        return run(["runuser", "-u", username, "--", php, wp, *args, "--path=" + str(path)], check=check)

    if action == "summary":
        version = (wp_cmd("core", "version").get("stdout") or "").strip()
        plugins = wp_cmd("plugin", "list", "--format=json").get("stdout") or "[]"
        themes = wp_cmd("theme", "list", "--format=json").get("stdout") or "[]"
        return ok(
            app_id=payload.get("app_id"),
            wp_version=version,
            plugins=read_json_file_from_text(plugins),
            themes=read_json_file_from_text(themes),
            path=str(path),
        )
    if action == "autologin":
        target = str(payload.get("target") or payload.get("user") or payload.get("admin_user") or "admin")
        login_dir = path / "wp-content" / "uploads" / "ehpanel-login"
        login_dir.mkdir(parents=True, exist_ok=True)
        token = secrets.token_urlsafe(24)
        login_file = login_dir / f"{token}.php"
        login_file.write_text(
            f"""<?php
require_once dirname(__DIR__, 3) . '/wp-load.php';
$user = get_user_by('login', '{sql_string(target)}');
if (!$user) {{ $users = get_users(['role__in'=>['administrator'], 'number'=>1]); $user = $users ? $users[0] : null; }}
if (!$user) {{ http_response_code(404); exit('No user'); }}
wp_set_auth_cookie($user->ID, true);
@unlink(__FILE__);
wp_safe_redirect(admin_url());
exit;
""",
            encoding="utf-8",
        )
        chown_account(username, login_dir)
        return ok(
            app_id=payload.get("app_id"),
            login_url=f"{public_url(payload, payload['domain'])}/wp-content/uploads/ehpanel-login/{token}.php",
            login_user=target,
            expires_at=int(time.time()) + 120,
        )
    target = str(payload.get("target") or "")
    value = str(payload.get("value") or "")
    target_type = str(payload.get("target_type") or "")
    if action in {"plugin_activate", "plugin_deactivate", "plugin_update"} and target:
        verb = {"plugin_activate": "activate", "plugin_deactivate": "deactivate", "plugin_update": "update"}[action]
        result = wp_cmd("plugin", verb, target)
        return ok(output=(result.get("stdout") or result.get("stderr") or "").strip())
    if action in {"theme_activate", "theme_update"} and target:
        verb = "activate" if action == "theme_activate" else "update"
        result = wp_cmd("theme", verb, target)
        return ok(output=(result.get("stdout") or result.get("stderr") or "").strip())
    if action == "cache_flush":
        result = wp_cmd("cache", "flush")
        return ok(output=(result.get("stdout") or result.get("stderr") or "").strip())
    if action == "maintenance_on":
        result = wp_cmd("maintenance-mode", "activate")
        return ok(output=(result.get("stdout") or result.get("stderr") or "").strip())
    if action == "maintenance_off":
        result = wp_cmd("maintenance-mode", "deactivate")
        return ok(output=(result.get("stdout") or result.get("stderr") or "").strip())
    if action == "set_debug":
        result = wp_cmd("config", "set", "WP_DEBUG", "true" if value.lower() in {"1", "true", "on", "yes"} else "false", "--raw")
        return ok(output=(result.get("stdout") or result.get("stderr") or "").strip())
    if action == "set_wp_cron":
        result = wp_cmd("config", "set", "DISABLE_WP_CRON", "false" if value.lower() in {"1", "true", "on", "yes"} else "true", "--raw")
        return ok(output=(result.get("stdout") or result.get("stderr") or "").strip())
    if action == "repair_filesystem":
        chown_account(username, path)
        return ok(path=str(path), repaired=True)
    if action == "integrity_check":
        result = wp_cmd("core", "verify-checksums")
        return ok(output=(result.get("stdout") or result.get("stderr") or "").strip(), returncode=result.get("returncode"))
    return fail("UNSUPPORTED_TOOLKIT_ACTION", f"Accion WordPress no soportada localmente: {action}", action=action, target=target, target_type=target_type)


def read_json_file_from_text(text):
    try:
        return json.loads(text or "[]")
    except json.JSONDecodeError:
        return []


def node_toolkit(payload, settings):
    path = app_path(payload, settings)
    action = str(payload.get("action") or "summary")
    instance_id = payload.get("instance_id") or f"node-{payload.get('app_id')}"
    service, service_status = service_for_instance(instance_id)
    if action == "summary":
        package = read_json_file(path / "package.json")
        return ok(
            app_id=payload.get("app_id"),
            node_version=command_stdout([shutil.which("node") or "node", "--version"]),
            package_version=package.get("version", ""),
            service=service,
            service_status=service_status,
            path=str(path),
        )
    if action in {"restart_service", "install_dependencies", "build", "audit", "git_pull"}:
        if action == "restart_service":
            result = run(["systemctl", "restart", service], check=False)
        elif action == "install_dependencies":
            result = run(["npm", "install"], cwd=str(path), check=False)
        elif action == "build":
            result = run(["npm", "run", "build"], cwd=str(path), check=False)
        elif action == "audit":
            result = run(["npm", "audit", "--json"], cwd=str(path), check=False)
        else:
            result = run(["git", "pull", "origin", payload.get("branch") or "main"], cwd=str(path), check=False)
        return ok(action=action, returncode=result.get("returncode"), output=(result.get("stdout") or result.get("stderr") or "").strip()[-4000:])
    return fail("UNSUPPORTED_TOOLKIT_ACTION", f"Accion Node.js no soportada localmente: {action}")


def python_toolkit(payload, settings):
    path = app_path(payload, settings)
    action = str(payload.get("action") or "summary")
    instance_id = payload.get("instance_id") or f"python-{payload.get('app_id')}"
    service, service_status = service_for_instance(instance_id)
    venv_python = path / ".venv" / "bin" / "python"
    python_bin = str(venv_python) if venv_python.exists() else (shutil.which("python3") or "python3")
    if action == "summary":
        django_version = command_stdout([python_bin, "-m", "django", "--version"])
        return ok(app_id=payload.get("app_id"), python_version=command_stdout([python_bin, "--version"]), django_version=django_version, service=service, service_status=service_status, path=str(path))
    if action in {"restart_service", "migrate", "collectstatic", "reinstall_requirements", "clear_sessions", "git_pull", "check_deploy"}:
        if action == "restart_service":
            result = run(["systemctl", "restart", service], check=False)
        elif action == "migrate":
            result = run([python_bin, "manage.py", "migrate", "--noinput"], cwd=str(path), check=False)
        elif action == "collectstatic":
            result = run([python_bin, "manage.py", "collectstatic", "--noinput"], cwd=str(path), check=False)
        elif action == "reinstall_requirements":
            pip = str(path / ".venv" / "bin" / "pip") if (path / ".venv" / "bin" / "pip").exists() else (shutil.which("pip3") or "pip3")
            requirements = path / "requirements.txt"
            result = run([pip, "install", "-r", str(requirements)], cwd=str(path), check=False) if requirements.exists() else run([pip, "install", "django", "gunicorn"], cwd=str(path), check=False)
        elif action == "clear_sessions":
            result = run([python_bin, "manage.py", "clearsessions"], cwd=str(path), check=False)
        elif action == "git_pull":
            result = run(["git", "pull", "origin", payload.get("branch") or "main"], cwd=str(path), check=False)
        else:
            result = run([python_bin, "manage.py", "check"], cwd=str(path), check=False)
        return ok(action=action, returncode=result.get("returncode"), output=(result.get("stdout") or result.get("stderr") or "").strip()[-4000:])
    return fail("UNSUPPORTED_TOOLKIT_ACTION", f"Accion Python/Django no soportada localmente: {action}")


def laravel_toolkit(payload, settings):
    path = app_path(payload, settings)
    action = str(payload.get("action") or "summary")
    instance_id = payload.get("instance_id") or f"laravel-{payload.get('app_id')}"
    service, service_status = service_for_instance(instance_id)
    php = php_binary(payload.get("php_version") or settings.get("php_version") or "8.5")
    if action == "summary":
        version = command_stdout([php, "artisan", "--version"], cwd=str(path)) if (path / "artisan").exists() else ""
        return ok(app_id=payload.get("app_id"), php_version=command_stdout([php, "-r", "echo PHP_VERSION;"]), laravel_version=version, service=service, service_status=service_status, path=str(path))
    if action in {"restart_service", "composer_install", "composer_update", "composer_audit", "migrate", "storage_link", "optimize", "cache_clear", "key_generate", "git_pull"}:
        if action == "restart_service":
            result = run(["systemctl", "restart", service], check=False)
        elif action == "composer_install":
            result = run([ensure_composer(), "install", "--no-interaction"], cwd=str(path), env={"COMPOSER_ALLOW_SUPERUSER": "1"}, check=False)
        elif action == "composer_update":
            result = run([ensure_composer(), "update", "--no-interaction"], cwd=str(path), env={"COMPOSER_ALLOW_SUPERUSER": "1"}, check=False)
        elif action == "composer_audit":
            result = run([ensure_composer(), "audit"], cwd=str(path), env={"COMPOSER_ALLOW_SUPERUSER": "1"}, check=False)
        elif action == "git_pull":
            result = run(["git", "pull", "origin", payload.get("branch") or "main"], cwd=str(path), check=False)
        else:
            artisan_action = {"migrate": ["migrate", "--force"], "storage_link": ["storage:link"], "optimize": ["optimize"], "cache_clear": ["cache:clear"], "key_generate": ["key:generate", "--force"]}[action]
            result = run([php, "artisan", *artisan_action], cwd=str(path), check=False)
        return ok(action=action, returncode=result.get("returncode"), output=(result.get("stdout") or result.get("stderr") or "").strip()[-4000:])
    return fail("UNSUPPORTED_TOOLKIT_ACTION", f"Accion Laravel no soportada localmente: {action}")


def collect_app_logs(payload, settings):
    instance_id = payload.get("instance_id") or f"{payload.get('runtime')}-{payload.get('app_id')}"
    service = app_service_name(instance_id)
    limit = str(int(payload.get("limit") or 120))
    result = run(["journalctl", "-u", service, "-n", limit, "--no-pager"], check=False)
    lines = (result.get("stdout") or result.get("stderr") or "").splitlines()
    return ok(lines=lines[-int(limit):], service=service)


def create_mail_domain(payload, settings):
    if not settings.get("provision_mail", True):
        return ok(skipped=True, reason="mail_disabled")
    domain = validate_domain(payload["domain"])
    mail_root = Path("/var/vmail") / domain
    mail_root.mkdir(parents=True, exist_ok=True)
    if user_exists("vmail"):
        run(["chown", "-R", "vmail:vmail", str(mail_root)], check=False)
    restore_selinux_context(mail_root)
    postfix_synced = register_postfix_domain(domain, settings)
    return ok(domain=domain, path=str(mail_root), postfix_synced=postfix_synced)


def configure_webmail_domain(payload, settings):
    domain = validate_domain(payload["domain"])
    username = payload["username"]
    ssl = bool(payload.get("ssl") or payload.get("ssl_active"))
    mail_autoconfig = write_mail_autoconfig_nginx_proxy(domain, username, settings, ssl=ssl)
    target = write_webmail_nginx_proxy(domain, username, settings, ssl=ssl)
    run(["nginx", "-t"])
    run(["systemctl", "reload", "nginx"], check=False)
    return ok(
        domain=domain,
        webmail_domain=f"webmail.{domain}",
        webmail_conf=str(target) if target else "",
        mail_autoconfig_conf=str(mail_autoconfig),
    )


def create_mailbox(payload, settings):
    if not settings.get("provision_mail", True):
        return ok(skipped=True, reason="mail_disabled")
    email = payload.get("email") or f"{payload.get('local_part')}@{payload.get('domain')}"
    local, domain = email.split("@", 1)
    domain = validate_domain(domain)
    safe_local = safe_mail_local(local)
    home = Path("/var/vmail") / domain / safe_local
    maildir = home / "Maildir"
    maildir.mkdir(parents=True, exist_ok=True)
    if user_exists("vmail"):
        run(["chown", "-R", "vmail:vmail", str(home)], check=False)
    restore_selinux_context(home)
    password_synced = write_dovecot_passwd_entry(email, payload.get("password"), home, settings)
    postfix_synced = register_postfix_mailbox(email, home, settings)
    return ok(email=email, path=str(maildir), password_synced=password_synced, postfix_synced=postfix_synced)


def mailbox_path(email):
    local, domain = email.split("@", 1)
    domain = validate_domain(domain)
    safe_local = safe_mail_local(local)
    return Path("/var/vmail") / domain / safe_local


def mailbox_json_job(payload, filename):
    email = payload["email"]
    base = mailbox_path(email)
    base.mkdir(parents=True, exist_ok=True)
    target = base / filename
    target.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    if user_exists("vmail"):
        run(["chown", "-R", "vmail:vmail", str(base)], check=False)
    restore_selinux_context(base)
    return ok(email=email, path=str(target))


def change_mailbox_password(payload, settings):
    email = payload["email"]
    base = mailbox_path(email)
    base.mkdir(parents=True, exist_ok=True)
    if user_exists("vmail"):
        run(["chown", "-R", "vmail:vmail", str(base)], check=False)
    restore_selinux_context(base)
    password_synced = write_dovecot_passwd_entry(email, payload.get("password"), base, settings)
    postfix_synced = register_postfix_mailbox(email, base, settings)
    result = mailbox_json_job(
        {"email": email, "password_set": bool(payload.get("password")), "password_synced": password_synced, "postfix_synced": postfix_synced},
        ".ehpanel-password.json",
    )
    return result


def set_mailbox_quota(payload):
    base = mailbox_path(payload["email"])
    maildir = base / "Maildir"
    maildir.mkdir(parents=True, exist_ok=True)
    quota_mb = int(payload.get("quota_mb") or 0)
    if quota_mb > 0:
        (maildir / "maildirsize").write_text(f"{quota_mb * 1024 * 1024}S\n", encoding="utf-8")
    if user_exists("vmail"):
        run(["chown", "-R", "vmail:vmail", str(base)], check=False)
    restore_selinux_context(base)
    return ok(email=payload["email"], quota_mb=quota_mb, path=str(maildir))


def suspend_mailbox(payload, suspended=True):
    base = mailbox_path(payload["email"])
    base.mkdir(parents=True, exist_ok=True)
    marker = base / ".ehpanel-suspended"
    if suspended:
        marker.write_text("1\n", encoding="utf-8")
    elif marker.exists():
        marker.unlink()
    return ok(email=payload["email"], suspended=suspended)


def delete_mailbox(payload, settings):
    email = payload["email"]
    remove_dovecot_passwd_entry(email, settings)
    remove_postfix_mailbox(email, settings)
    base = mailbox_path(email)
    if base.exists():
        shutil.rmtree(base)
    return ok(email=email, deleted=True)


def account_lock(payload, locked):
    username = payload["username"]
    validate_username(username)
    run(["usermod", "-L" if locked else "-U", username], check=False)
    return ok(username=username, locked=locked)


def ftp_root_path(payload, settings):
    account_username = payload.get("account_username")
    validate_username(account_username)
    home = Path(settings["home_root"]) / account_username
    root = Path(payload.get("root") or home / str(payload.get("relative_root") or "public_html").strip("/")).resolve(strict=False)
    if os.path.commonpath([str(home.resolve(strict=False)), str(root)]) != str(home.resolve(strict=False)):
        raise ValueError("Ruta FTP fuera de la cuenta.")
    root.mkdir(parents=True, exist_ok=True)
    return root


def grant_ftp_acl(username, root):
    if shutil.which("setfacl"):
        run(["setfacl", "-R", "-m", f"u:{username}:rwx", str(root)], check=False)
        run(["setfacl", "-d", "-m", f"u:{username}:rwx", str(root)], check=False)


def remove_ftp_acl(username, root):
    if shutil.which("setfacl") and root.exists():
        run(["setfacl", "-R", "-x", f"u:{username}", str(root)], check=False)
        run(["setfacl", "-d", "-x", f"u:{username}", str(root)], check=False)


def create_ftp_user(payload, settings):
    username = payload["username"]
    validate_username(username)
    account_username = payload.get("account_username")
    validate_username(account_username)
    root = ftp_root_path(payload, settings)
    shell = payload.get("shell") or "/usr/sbin/nologin"
    if not user_exists(username):
        run(["useradd", "-M", "-d", str(root), "-s", shell, "-g", account_username, username])
    else:
        run(["usermod", "-d", str(root), "-s", shell, "-g", account_username, username], check=False)
    if payload.get("password"):
        run(["chpasswd"], input_text=f"{username}:{payload['password']}\n")
    grant_ftp_acl(username, root)
    return ok(username=username, root=str(root), protocol=payload.get("protocol") or "ftps")


def delete_ftp_user(payload, settings):
    username = payload["username"]
    validate_username(username)
    root = ftp_root_path(payload, settings)
    remove_ftp_acl(username, root)
    if user_exists(username):
        run(["userdel", username], check=False)
    return ok(username=username, root=str(root), deleted=True)


SAFE_ADVANCED_ID = re.compile(r"^[0-9]{1,18}$")
SAFE_HEADER_NAME = re.compile(r"^[A-Za-z0-9-]{1,80}$")
SAFE_ENV_KEY = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,127}$")
SAFE_CRON_SCHEDULE = re.compile(r"^[A-Za-z0-9_*,/\-?LW# ]{5,120}$")


def advanced_root(settings):
    return Path(settings.get("advanced_root") or "/etc/ehpanel/advanced")


def advanced_item_id(payload):
    item_id = str(payload.get("item_id") or "").strip()
    if not SAFE_ADVANCED_ID.match(item_id):
        raise ValueError("ID avanzado invalido.")
    return item_id


def safe_account_relative(home, value, default="."):
    relative = str(value or default).strip().strip("/").replace("\\", "/")
    if not relative:
        relative = default
    target = (home / relative).resolve(strict=False)
    home_resolved = home.resolve(strict=False)
    if os.path.commonpath([str(home_resolved), str(target)]) != str(home_resolved):
        raise ValueError("Ruta fuera de la cuenta.")
    return target


def nginx_test_reload():
    test = run(["nginx", "-t"], check=False)
    if test["returncode"] != 0:
        raise RuntimeError(test.get("stderr") or test.get("stdout") or "nginx -t fallo.")
    run(["systemctl", "reload", "nginx"], check=False)
    return test


def atomic_write_text(path, text, mode=0o644, owner=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.chmod(mode)
    if owner:
        run(["chown", owner, str(tmp)], check=False)
    tmp.replace(path)


def write_nginx_advanced_snippet(path, text, domain, settings):
    previous = path.read_text(encoding="utf-8", errors="ignore") if path.exists() else None
    atomic_write_text(path, text, 0o644)
    try:
        ensure_nginx_advanced_include(domain, settings)
        result = nginx_test_reload()
        return result
    except Exception:
        if previous is None:
            path.unlink(missing_ok=True)
        else:
            atomic_write_text(path, previous, 0o644)
        run(["nginx", "-t"], check=False)
        raise


def remove_nginx_advanced_snippet(path):
    if not path.exists():
        return False
    path.unlink()
    nginx_test_reload()
    return True


def remove_managed_block(path, marker):
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8", errors="ignore")
    pattern = re.compile(rf"\n?# BEGIN {re.escape(marker)}\n.*?\n# END {re.escape(marker)}\n?", re.DOTALL)
    updated = pattern.sub("\n", text).strip() + "\n"
    if updated != text:
        path.write_text(updated if updated.strip() else "", encoding="utf-8")
        return True
    return False


def write_managed_block(path, marker, body, mode=0o600, owner=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = path.read_text(encoding="utf-8", errors="ignore") if path.exists() else ""
    remove_managed_block(path, marker)
    existing = path.read_text(encoding="utf-8", errors="ignore") if path.exists() else ""
    block = f"# BEGIN {marker}\n{body.rstrip()}\n# END {marker}\n"
    text = (existing.rstrip() + "\n\n" + block).lstrip()
    path.write_text(text, encoding="utf-8")
    path.chmod(mode)
    if owner:
        run(["chown", owner, str(path)], check=False)


def apply_advanced_item(payload, settings):
    item_id = advanced_item_id(payload)
    username = payload["username"]
    validate_username(username)
    domain = validate_domain(payload["domain"])
    kind = str(payload.get("kind") or "")
    config = payload.get("config") if isinstance(payload.get("config"), dict) else {}
    enabled = bool(payload.get("enabled", True)) and not bool(payload.get("delete"))
    home = Path(settings["home_root"]) / username
    if not home.exists():
        raise ValueError(f"No existe la cuenta local {username}.")

    marker = f"EHPANEL-{item_id}"
    safe_domain = safe_vhost_name(domain)
    nginx_dir = Path("/etc/nginx/ehpanel-advanced")
    nginx_path = nginx_dir / f"{safe_domain}-{item_id}.conf"
    root = advanced_root(settings) / username
    root.mkdir(parents=True, exist_ok=True)

    if not enabled:
        changed = False
        if kind in {"redirect", "header", "vhost_manual"} and nginx_path.exists():
            changed = remove_nginx_advanced_snippet(nginx_path)
        cron_path = Path("/etc/cron.d") / f"ehpanel-{username}-{item_id}"
        if cron_path.exists():
            cron_path.unlink()
            changed = True
        remove_managed_block(home / ".ssh" / "authorized_keys", marker)
        for folder in ["env.d", "git", "webhooks"]:
            target = home / ".ehpanel" / folder / f"{item_id}.json"
            target.unlink(missing_ok=True)
        env_file = home / ".ehpanel" / "env.d" / f"{item_id}.env"
        env_file.unlink(missing_ok=True)
        return ok(item_id=item_id, kind=kind, enabled=False, changed=changed)

    if kind == "ssh_key":
        public_key = str(config.get("public_key") or "").strip()
        if not re.match(r"^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521))\s+[A-Za-z0-9+/=]+(?:\s+.*)?$", public_key):
            raise ValueError("Clave publica SSH invalida.")
        ssh_dir = home / ".ssh"
        ssh_dir.mkdir(parents=True, exist_ok=True)
        ssh_dir.chmod(0o700)
        run(["chown", f"{username}:{username}", str(ssh_dir)], check=False)
        write_managed_block(ssh_dir / "authorized_keys", marker, public_key, mode=0o600, owner=f"{username}:{username}")
        return ok(item_id=item_id, kind=kind, authorized_keys=str(ssh_dir / "authorized_keys"))

    if kind == "cron":
        schedule = str(config.get("schedule") or "").strip()
        command = str(config.get("command") or "").strip()
        if not SAFE_CRON_SCHEDULE.match(schedule) or len(schedule.split()) != 5:
            raise ValueError("Frecuencia cron invalida.")
        if not command:
            raise ValueError("El cron requiere comando.")
        cron_user = str(config.get("user") or username).strip()
        if cron_user != username:
            raise ValueError("El cron solo puede ejecutarse con el usuario de la cuenta.")
        working_dir = safe_account_relative(home, config.get("working_dir"), ".")
        cron_path = Path("/etc/cron.d") / f"ehpanel-{username}-{item_id}"
        line = f"SHELL=/bin/bash\nPATH=/usr/local/bin:/usr/bin:/bin\n{schedule} {username} cd {working_dir} && {command}\n"
        atomic_write_text(cron_path, line, 0o644)
        return ok(item_id=item_id, kind=kind, cron=str(cron_path), working_dir=str(working_dir))

    if kind == "variable":
        key = str(config.get("key") or "").strip()
        value = str(config.get("value") or "")
        if not SAFE_ENV_KEY.match(key):
            raise ValueError("Nombre de variable invalido.")
        env_dir = home / ".ehpanel" / "env.d"
        env_dir.mkdir(parents=True, exist_ok=True)
        run(["chown", "-R", f"{username}:{username}", str(home / ".ehpanel")], check=False)
        escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
        env_path = env_dir / f"{item_id}.env"
        atomic_write_text(env_path, f'{key}="{escaped}"\n', 0o600, f"{username}:{username}")
        return ok(item_id=item_id, kind=kind, env_file=str(env_path), key=key)

    if kind == "git_repo":
        repo_url = str(config.get("repo_url") or "").strip()
        if not re.match(r"^(https://|git@|ssh://)", repo_url):
            raise ValueError("URL de repositorio Git invalida.")
        git_dir = home / ".ehpanel" / "git"
        git_dir.mkdir(parents=True, exist_ok=True)
        atomic_write_text(git_dir / f"{item_id}.json", json.dumps(config, indent=2, sort_keys=True), 0o600, f"{username}:{username}")
        working_dir_value = config.get("working_dir") or config.get("path")
        pull_result = None
        if working_dir_value:
            working_dir = safe_account_relative(home, working_dir_value, ".")
            if (working_dir / ".git").exists():
                pull_result = run(["sudo", "-u", username, "git", "-C", str(working_dir), "pull", "--ff-only"], check=False)
        return ok(item_id=item_id, kind=kind, git_config=str(git_dir / f"{item_id}.json"), pull_result=pull_result)

    if kind == "redirect":
        source = str(config.get("source") or "").strip() or "/"
        target = str(config.get("target") or "").strip()
        code = str(config.get("code") or "301").strip()
        if not source.startswith("/") or re.search(r"[\r\n{};]", source):
            raise ValueError("Origen de redireccion invalido.")
        if not target or re.search(r"[\r\n{};]", target):
            raise ValueError("Destino de redireccion invalido.")
        if code not in {"301", "302", "307", "308"}:
            raise ValueError("Codigo de redireccion invalido.")
        snippet = f"    location = {source} {{\n        return {code} {target};\n    }}\n"
        write_nginx_advanced_snippet(nginx_path, snippet, domain, settings)
        return ok(item_id=item_id, kind=kind, nginx_conf=str(nginx_path))

    if kind == "header":
        header = str(config.get("header") or "").strip()
        value = str(config.get("value") or "").strip()
        if not SAFE_HEADER_NAME.match(header):
            raise ValueError("Header invalido.")
        if not value or re.search(r"[\r\n\"]", value):
            raise ValueError("Valor de header invalido.")
        snippet = f"    add_header {header} \"{value}\" always;\n"
        write_nginx_advanced_snippet(nginx_path, snippet, domain, settings)
        return ok(item_id=item_id, kind=kind, nginx_conf=str(nginx_path))

    if kind == "webhook":
        url = str(config.get("url") or "").strip()
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("URL de webhook invalida.")
        webhook_dir = home / ".ehpanel" / "webhooks"
        webhook_dir.mkdir(parents=True, exist_ok=True)
        atomic_write_text(webhook_dir / f"{item_id}.json", json.dumps(config, indent=2, sort_keys=True), 0o600, f"{username}:{username}")
        return ok(item_id=item_id, kind=kind, webhook_config=str(webhook_dir / f"{item_id}.json"))

    if kind == "vhost_manual":
        nginx = str(config.get("nginx") or "").strip()
        if not nginx:
            return ok(item_id=item_id, kind=kind, skipped=True, detail="Sin directivas nginx.")
        if re.search(r"(?im)^\s*(server|http|events|stream)\s*\{", nginx):
            raise ValueError("VHost manual solo acepta directivas de contexto server, no bloques server/http.")
        snippet = "\n".join(f"    {line}" if line.strip() else "" for line in nginx.splitlines()) + "\n"
        write_nginx_advanced_snippet(nginx_path, snippet, domain, settings)
        return ok(item_id=item_id, kind=kind, nginx_conf=str(nginx_path))

    raise ValueError(f"Tipo avanzado no soportado: {kind}")


def service_action(payload, settings=None):
    if str(payload.get("action") or "").strip() == "apply_advanced_item":
        return apply_advanced_item(payload, settings or {})

    service = str(payload.get("service") or "").strip()
    action = str(payload.get("action") or "").strip()
    allowed_services = {"nginx", "lshttpd", "postgresql", "mariadb", "valkey", "postfix", "dovecot", "rspamd", "ehpanel-web", "ehpanel-webmail"}
    if service not in allowed_services:
        return fail("SERVICE_NOT_ALLOWED", f"Servicio no permitido: {service}")

    if service == "postfix" and action in {"mail_queue", "list_mail_queue", "collect_mail_queue"}:
        result = run(["postqueue", "-p"], check=False)
        return ok(service=service, action=action, mail_queue_raw=result.get("stdout", ""))

    queue_id = str(payload.get("queue_id") or "").strip()
    if service == "postfix" and action == "retry_mail_queue" and queue_id:
        result = run(["postsuper", "-r", queue_id], check=False)
        return ok(service=service, action=action, queue_id=queue_id, result=result)
    if service == "postfix" and action == "release_mail_queue" and queue_id:
        result = run(["postsuper", "-H", queue_id], check=False)
        return ok(service=service, action=action, queue_id=queue_id, result=result)

    systemd_action = {
        "status": "is-active",
        "start": "start",
        "stop": "stop",
        "restart": "restart",
        "reload": "reload",
    }.get(action)
    if not systemd_action:
        return fail("SERVICE_ACTION_NOT_ALLOWED", f"Accion no permitida: {action}")
    result = run(["systemctl", systemd_action, service], check=False)
    active = run(["systemctl", "is-active", service], check=False)
    return ok(service=service, action=action, active=active.get("stdout", "").strip(), result=result)


def account_home(payload, settings):
    username = payload["username"]
    validate_username(username)
    return Path(settings["home_root"]) / username


def relative_account_path(path):
    value = str(path or "/").strip().replace("\\", "/")
    if not value or value == ".":
        value = "/"
    return value if value.startswith("/") else f"/{value}"


def safe_account_path(payload, settings, key="path"):
    home = account_home(payload, settings).resolve(strict=False)
    rel = relative_account_path(payload.get(key) or "/").lstrip("/")
    target = (home / rel).resolve(strict=False)
    if os.path.commonpath([str(home), str(target)]) != str(home):
        raise ValueError("Ruta fuera de la cuenta.")
    return home, target, f"/{rel}".rstrip("/") or "/"


def mode_string(path):
    try:
        return oct(path.stat().st_mode & 0o777)[2:].zfill(3)
    except OSError:
        return "-"


def file_item(home, path):
    stat = path.stat()
    rel = "/" + str(path.relative_to(home)).replace("\\", "/")
    if rel == "/.":
        rel = "/"
    return {
        "name": path.name or "/",
        "path": rel,
        "absolute_path": str(path),
        "type": "dir" if path.is_dir() else "file",
        "size": 0 if path.is_dir() else stat.st_size,
        "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
        "mode": mode_string(path),
    }


def file_list(payload, settings):
    home, target, rel = safe_account_path(payload, settings)
    if not target.exists():
        return fail("FILE_NOT_FOUND", f"No existe la ruta: {rel}")
    if not target.is_dir():
        return fail("NOT_A_DIRECTORY", f"No es un directorio: {rel}")
    items = [file_item(home, item) for item in sorted(target.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower()))]
    return ok(path=rel, absolute_path=str(target), items=items)


def file_read(payload, settings):
    _home, target, rel = safe_account_path(payload, settings)
    if not target.exists() or not target.is_file():
        return fail("FILE_NOT_FOUND", f"No existe el archivo: {rel}")
    size = target.stat().st_size
    if size > TEXT_FILE_LIMIT:
        return fail("FILE_TOO_LARGE", "El archivo supera el limite de lectura en editor.")
    content = target.read_text(encoding="utf-8", errors="replace")
    return ok(path=rel, absolute_path=str(target), content=content, size=size, mode=mode_string(target))


def file_write(payload, settings):
    username = payload["username"]
    home, target, rel = safe_account_path(payload, settings)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(str(payload.get("content") or ""), encoding="utf-8")
    run(["chown", f"{username}:{username}", str(target)], check=False)
    return ok(path=rel, absolute_path=str(target), size=target.stat().st_size, mode=mode_string(target))


def ensure_target_available(target, overwrite):
    if target.exists() and not overwrite:
        raise FileExistsError("El destino ya existe.")
    if target.exists() and target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()


def chown_account_path(username, path, recursive=False):
    args = ["chown"]
    if recursive:
        args.append("-R")
    args.extend([f"{username}:{username}", str(path)])
    run(args, check=False)
    restore_selinux_context(path)


def file_upload(payload, settings):
    username = payload["username"]
    source = Path(payload.get("source_path") or "")
    if not source.exists() or not source.is_file():
        return fail("UPLOAD_SOURCE_NOT_FOUND", "No se encontro el archivo temporal de carga.")
    _home, target, rel = safe_account_path(payload, settings)
    target.parent.mkdir(parents=True, exist_ok=True)
    ensure_target_available(target, bool(payload.get("overwrite", True)))
    shutil.copy2(source, target)
    chown_account_path(username, target)
    source.unlink(missing_ok=True)
    return ok(path=rel, absolute_path=str(target), size=target.stat().st_size, mode=mode_string(target))


def filename_from_url(url):
    parsed = urlparse(url)
    name = Path(parsed.path).name
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name or "download.bin").strip("._")
    return safe or "download.bin"


def file_import_url(payload, settings):
    username = payload["username"]
    url = str(payload.get("url") or "").strip()
    if not re.match(r"^https?://", url, re.IGNORECASE):
        return fail("INVALID_URL", "Solo se permiten URLs http o https.")
    requested_path = relative_account_path(payload.get("path") or filename_from_url(url))
    home, target, rel = safe_account_path({"username": username, "path": requested_path}, settings)
    if requested_path.endswith("/") or (target.exists() and target.is_dir()):
        target = (target / filename_from_url(url)).resolve(strict=False)
        if os.path.commonpath([str(home), str(target)]) != str(home):
            raise ValueError("Archivo destino fuera de la cuenta.")
        rel = "/" + str(target.relative_to(home)).replace("\\", "/")
    target.parent.mkdir(parents=True, exist_ok=True)
    ensure_target_available(target, bool(payload.get("overwrite", True)))
    with urllib.request.urlopen(url, timeout=60) as response, target.open("wb") as output:
        shutil.copyfileobj(response, output)
    chown_account_path(username, target)
    return ok(path=rel, absolute_path=str(target), size=target.stat().st_size, mode=mode_string(target))


def file_delete(payload, settings):
    _home, target, rel = safe_account_path(payload, settings)
    if not target.exists():
        return ok(path=rel, deleted=False)
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    return ok(path=rel, deleted=True)


def file_copy(payload, settings):
    username = payload["username"]
    home, source, rel_source = safe_account_path(payload, settings)
    if not source.exists():
        return fail("FILE_NOT_FOUND", f"No existe la ruta: {rel_source}")
    _home, destination, rel_destination = safe_account_path(payload, settings, key="destination_path")
    ensure_target_available(destination, bool(payload.get("overwrite", True)))
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        shutil.copytree(source, destination)
        chown_account_path(username, destination, recursive=True)
    else:
        shutil.copy2(source, destination)
        chown_account_path(username, destination)
    return ok(path=rel_source, destination_path=rel_destination, absolute_path=str(destination))


def file_move(payload, settings):
    username = payload["username"]
    home, source, rel_source = safe_account_path(payload, settings)
    if not source.exists():
        return fail("FILE_NOT_FOUND", f"No existe la ruta: {rel_source}")
    _home, destination, rel_destination = safe_account_path(payload, settings, key="destination_path")
    ensure_target_available(destination, bool(payload.get("overwrite", True)))
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(destination))
    chown_account_path(username, destination, recursive=destination.is_dir())
    return ok(path=rel_source, destination_path=rel_destination, absolute_path=str(destination), moved=True)


def file_mkdir(payload, settings):
    username = payload["username"]
    _home, target, rel = safe_account_path(payload, settings)
    target.mkdir(parents=True, exist_ok=True)
    run(["chown", f"{username}:{username}", str(target)], check=False)
    return ok(path=rel, absolute_path=str(target), mode=mode_string(target))


def file_chmod(payload, settings):
    _home, target, rel = safe_account_path(payload, settings)
    mode = str(payload.get("mode") or "").strip()
    if not re.match(r"^[0-7]{3,4}$", mode):
        return fail("INVALID_MODE", f"Modo invalido: {mode}")
    if not target.exists():
        return fail("FILE_NOT_FOUND", f"No existe la ruta: {rel}")
    target.chmod(int(mode, 8))
    return ok(path=rel, mode=mode_string(target))


def file_compress(payload, settings):
    username = payload["username"]
    home = account_home(payload, settings).resolve(strict=False)
    paths = payload.get("paths") or []
    if not paths:
        return fail("NO_FILES_SELECTED", "No hay archivos seleccionados.")
    destination_payload = {"username": username, "path": payload.get("destination_path") or "/"}
    _home, destination, _rel_dest = safe_account_path(destination_payload, settings)
    destination.mkdir(parents=True, exist_ok=True)
    archive_name = re.sub(r"[^A-Za-z0-9._-]+", "_", str(payload.get("archive_name") or "archivos")).strip("._") or "archivos"
    archive_format = str(payload.get("format") or "zip").lower()
    if archive_format not in {"zip", "tar", "tar.gz"}:
        return fail("INVALID_ARCHIVE_FORMAT", f"Formato no permitido: {archive_format}")
    suffix = ".tar.gz" if archive_format == "tar.gz" else f".{archive_format}"
    if not archive_name.lower().endswith(suffix):
        archive_name += suffix
    target = (destination / archive_name).resolve(strict=False)
    if os.path.commonpath([str(home), str(target)]) != str(home):
        raise ValueError("Archivo destino fuera de la cuenta.")
    sources = [safe_account_path({"username": username, "path": item}, settings)[1] for item in paths]
    if archive_format == "zip":
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for source in sources:
                if source.is_dir():
                    for item in source.rglob("*"):
                        archive.write(item, item.relative_to(home))
                elif source.exists():
                    archive.write(source, source.relative_to(home))
    else:
        mode = "w:gz" if archive_format == "tar.gz" else "w"
        with tarfile.open(target, mode) as archive:
            for source in sources:
                if source.exists():
                    archive.add(source, arcname=str(source.relative_to(home)))
    run(["chown", f"{username}:{username}", str(target)], check=False)
    rel = "/" + str(target.relative_to(home)).replace("\\", "/")
    return ok(path=rel, absolute_path=str(target), size=target.stat().st_size)


def file_extract(payload, settings):
    username = payload["username"]
    home, source, rel = safe_account_path(payload, settings)
    if not source.exists() or not source.is_file():
        return fail("FILE_NOT_FOUND", f"No existe el archivo: {rel}")
    destination_payload = {"username": username, "path": payload.get("destination_path") or "/"}
    _home, destination, rel_dest = safe_account_path(destination_payload, settings)
    destination.mkdir(parents=True, exist_ok=True)

    def ensure_inside(path):
        target = (destination / path).resolve(strict=False)
        if os.path.commonpath([str(home), str(target)]) != str(home):
            raise ValueError("El archivo comprimido intenta escribir fuera de la cuenta.")
        return target

    lower = source.name.lower()
    if lower.endswith(".zip"):
        with zipfile.ZipFile(source) as archive:
            for member in archive.namelist():
                ensure_inside(member)
            archive.extractall(destination)
    elif lower.endswith(".tar") or lower.endswith(".tar.gz") or lower.endswith(".tgz"):
        with tarfile.open(source) as archive:
            for member in archive.getmembers():
                ensure_inside(member.name)
            archive.extractall(destination)
    else:
        return fail("UNSUPPORTED_ARCHIVE", "Formato de archivo no soportado.")
    run(["chown", "-R", f"{username}:{username}", str(destination)], check=False)
    return ok(path=rel, destination_path=rel_dest, extracted=True)


def file_download(payload, settings):
    _home, source, rel = safe_account_path(payload, settings)
    if not source.exists() or not source.is_file():
        return fail("FILE_NOT_FOUND", f"No existe el archivo: {rel}")
    export_path = Path(payload.get("export_path") or "")
    if not export_path:
        return fail("EXPORT_PATH_REQUIRED", "Ruta temporal de descarga requerida.")
    export_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, export_path)
    export_path.chmod(0o644)
    return ok(path=rel, export_path=str(export_path), size=export_path.stat().st_size)


def service_state(*services):
    state = {}
    for service in services:
        result = run(["systemctl", "is-active", service], check=False)
        status = (result.get("stdout") or result.get("stderr") or "unknown").strip()
        state[service] = {"active": status == "active", "status": status}
    return state


def php_binary(version):
    digits = re.sub(r"[^0-9]", "", str(version or ""))
    candidates = []
    if len(digits) >= 2:
        short = digits[:2]
        candidates.extend([
            f"/usr/local/lsws/lsphp{short}/bin/php",
            f"/usr/bin/lsphp{short}",
            f"/opt/remi/php{short}/root/usr/bin/php",
        ])
    candidates.extend(["/usr/bin/php", "php"])
    for candidate in candidates:
        if shutil.which(candidate) or Path(candidate).exists():
            return candidate
    return "php"


def command_stdout(args, cwd=None):
    try:
        result = run(args, cwd=cwd, check=False)
    except FileNotFoundError:
        return ""
    return (result.get("stdout") or result.get("stderr") or "").strip()


def php_ini_value(binary, key):
    code = f'echo ini_get("{key}");'
    return command_stdout([binary, "-r", code])


def read_key_value_file(path):
    values = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith(";") or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def performance_target_url(payload):
    domain = validate_domain(payload["domain"])
    raw = str(payload.get("target_url") or "").strip()
    if not raw:
        raw = f"https://{domain}/"
    elif raw.startswith("/"):
        raw = f"https://{domain}{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or parsed.netloc.lower() not in {domain, f"www.{domain}"}:
        raise ValueError("La auditoria solo acepta URLs del dominio de la cuenta.")
    return raw


def curl_timing_sample(url):
    fmt = "%{time_namelookup} %{time_connect} %{time_starttransfer} %{time_total} %{http_code} %{size_download}"
    started = time.time()
    result = run(["curl", "-k", "-L", "-o", "/dev/null", "-sS", "-w", fmt, "--max-time", "20", url], check=False)
    raw = (result.get("stdout") or result.get("stderr") or "").strip()
    parts = raw.split()
    if len(parts) < 6:
        return {
            "ok": False,
            "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started)),
            "error": raw or "curl no devolvio medicion.",
            "returncode": result.get("returncode"),
        }
    return {
        "ok": result.get("returncode") == 0,
        "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started)),
        "dns_ms": round(float(parts[0]) * 1000, 2),
        "connect_ms": round(float(parts[1]) * 1000, 2),
        "ttfb_ms": round(float(parts[2]) * 1000, 2),
        "total_ms": round(float(parts[3]) * 1000, 2),
        "code": int(parts[4]) if parts[4].isdigit() else 0,
        "bytes": int(parts[5]) if parts[5].isdigit() else 0,
        "returncode": result.get("returncode"),
    }


def process_snapshot(username):
    result = run(["ps", "-eo", "pid,user,comm,pcpu,pmem,rss,args", "--sort=-pcpu"], check=False)
    rows = []
    for line in (result.get("stdout") or "").splitlines()[1:80]:
        if username not in line and not re.search(r"\b(lsphp|php|lshttpd|nginx|mariadb|postgres)\b", line):
            continue
        parts = line.split(None, 6)
        if len(parts) < 7:
            continue
        rows.append({
            "pid": parts[0],
            "user": parts[1],
            "command": parts[2],
            "cpu_pct": float(parts[3]) if re.match(r"^\d+(\.\d+)?$", parts[3]) else 0,
            "mem_pct": float(parts[4]) if re.match(r"^\d+(\.\d+)?$", parts[4]) else 0,
            "rss_kb": int(float(parts[5])) if re.match(r"^\d+(\.\d+)?$", parts[5]) else 0,
            "args": parts[6][:240],
        })
    return rows[:20]


def parse_access_for_audit(domain, limit=300):
    safe_domain = safe_vhost_name(domain)
    lines = []
    for suffix in ["ssl-access", "access"]:
        path = Path(f"/var/log/nginx/ehpanel-{safe_domain}-{suffix}.log")
        if path.exists():
            lines.extend(path.read_text(encoding="utf-8", errors="ignore").splitlines()[-limit:])
    rows = []
    for line in lines[-limit:]:
        match = re.match(r'(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] "(?P<method>\S+)\s+(?P<path>\S+)[^"]*" (?P<code>\d{3}) (?P<bytes>\S+)', line)
        if not match:
            continue
        code = int(match.group("code"))
        rows.append({
            "time": match.group("time"),
            "ip": match.group("ip"),
            "method": match.group("method"),
            "path": match.group("path")[:220],
            "code": code,
            "bytes": int(match.group("bytes")) if match.group("bytes").isdigit() else 0,
        })
    return rows


def performance_recommendations(samples, access_rows, processes, errors, opcache_enabled):
    recommendations = []
    ok_samples = [item for item in samples if item.get("total_ms") is not None]
    if ok_samples:
        avg_ttfb = sum(float(item.get("ttfb_ms") or 0) for item in ok_samples) / len(ok_samples)
        avg_total = sum(float(item.get("total_ms") or 0) for item in ok_samples) / len(ok_samples)
        if avg_ttfb > 1200:
            recommendations.append("TTFB alto: revisar consultas PHP/BD, cache de pagina y plugins del sitio.")
        if avg_total > 2500:
            recommendations.append("Tiempo total alto: revisar peso de respuesta, compresion y recursos externos.")
    if any(int(item.get("code") or 0) >= 500 for item in access_rows[-50:]):
        recommendations.append("Hay errores HTTP 5xx recientes en access log; revisar error log y runtime PHP.")
    if any(float(item.get("cpu_pct") or 0) >= 40 for item in processes):
        recommendations.append("Se detectaron procesos con CPU alta durante la auditoria.")
    if not opcache_enabled:
        recommendations.append("OPcache no aparece activo; activarlo mejora sitios PHP con carga frecuente.")
    if errors:
        recommendations.append("Hay errores PHP/Nginx recientes relacionados con esta cuenta.")
    if not recommendations:
        recommendations.append("No se detectaron cuellos de botella criticos en esta muestra corta.")
    return recommendations


def run_web_performance_audit(payload, settings):
    username = payload["username"]
    validate_username(username)
    domain = validate_domain(payload["domain"])
    url = performance_target_url(payload)
    duration = max(5, min(int(payload.get("duration_seconds") or 15), 60))
    samples_count = max(1, min(int(payload.get("samples") or 6), 30))
    php = php_binary(payload.get("php_version") or settings.get("php_version") or "8.5")
    php_modules = {item.strip().lower() for item in command_stdout([php, "-m"]).splitlines() if item.strip()}
    opcache_enabled = "zend opcache" in php_modules or "opcache" in php_modules
    home = account_home(payload, settings)

    before_processes = process_snapshot(username)
    samples = []
    delay = duration / max(samples_count, 1)
    for index in range(samples_count):
        sample = curl_timing_sample(url)
        sample["index"] = index + 1
        samples.append(sample)
        if index + 1 < samples_count:
            time.sleep(min(delay, 5))
    after_processes = process_snapshot(username)

    access_rows = parse_access_for_audit(domain)
    top_paths = {}
    for row in access_rows:
        item = top_paths.setdefault(row["path"], {"path": row["path"], "hits": 0, "errors": 0, "bytes": 0})
        item["hits"] += 1
        item["bytes"] += int(row.get("bytes") or 0)
        if int(row.get("code") or 0) >= 400:
            item["errors"] += 1
    ranked_paths = sorted(top_paths.values(), key=lambda item: (item["errors"], item["hits"], item["bytes"]), reverse=True)[:10]
    error_lines = []
    for log_path in [home / "logs" / "php-error.log", Path(f"/var/log/nginx/ehpanel-{safe_vhost_name(domain)}-ssl-error.log"), Path(f"/var/log/nginx/ehpanel-{safe_vhost_name(domain)}-error.log")]:
        if log_path.exists():
            error_lines.extend(log_path.read_text(encoding="utf-8", errors="ignore").splitlines()[-20:])
    ok_samples = [item for item in samples if item.get("total_ms") is not None]
    avg_ttfb = round(sum(float(item.get("ttfb_ms") or 0) for item in ok_samples) / max(1, len(ok_samples)), 2)
    avg_total = round(sum(float(item.get("total_ms") or 0) for item in ok_samples) / max(1, len(ok_samples)), 2)
    max_total = round(max([float(item.get("total_ms") or 0) for item in ok_samples] or [0]), 2)
    status_codes = {}
    for item in samples:
        code = str(item.get("code") or "error")
        status_codes[code] = status_codes.get(code, 0) + 1
    processes = sorted(before_processes + after_processes, key=lambda item: (item["cpu_pct"], item["rss_kb"]), reverse=True)[:15]
    return ok(
        audit_id=payload.get("audit_id"),
        target_url=url,
        duration_seconds=duration,
        samples=samples,
        summary={
            "avg_ttfb_ms": avg_ttfb,
            "avg_total_ms": avg_total,
            "max_total_ms": max_total,
            "status_codes": status_codes,
            "opcache_enabled": opcache_enabled,
            "access_rows_analyzed": len(access_rows),
        },
        slow_requests=sorted(samples, key=lambda item: float(item.get("total_ms") or 0), reverse=True)[:10],
        top_paths=ranked_paths,
        processes=processes,
        recent_errors=error_lines[-30:],
        recommendations=performance_recommendations(samples, access_rows, processes, error_lines, opcache_enabled),
    )


def collect_software_info(payload, settings):
    username = payload["username"]
    domain = validate_domain(payload["domain"])
    home = account_home(payload, settings)
    public_dir = home / "public_html"
    software_dir = Path("/etc/ehpanel/software") / username
    binary = php_binary(payload.get("php_version"))
    php_ini_values = {
        key: php_ini_value(binary, key)
        for key in [
            "include_path",
            "session.save_path",
            "mail.force_extra_parameters",
            "open_basedir",
            "error_reporting",
            "display_errors",
            "log_errors",
            "allow_url_fopen",
            "file_uploads",
            "short_open_tag",
            "memory_limit",
            "max_execution_time",
            "max_input_time",
            "post_max_size",
            "upload_max_filesize",
            "max_file_uploads",
            "date.timezone",
        ]
    }
    php_modules = sorted({item.strip() for item in command_stdout([binary, "-m"]).splitlines() if item.strip() and not item.startswith("[")}, key=str.lower)
    php_ini = command_stdout([binary, "--ini"])
    loaded_match = re.search(r"Loaded Configuration File:\s+(.+)", php_ini)
    php_ini_path = loaded_match.group(1).strip() if loaded_match else ""
    user_ini = read_key_value_file(public_dir / ".user.ini")
    php_fpm_values = read_key_value_file(software_dir / "php-fpm.conf")
    if not php_fpm_values:
        php_fpm_values = {
            "pm.max_children": "20",
            "pm.max_requests": "500",
            "pm.start_servers": "2",
            "pm.min_spare_servers": "1",
            "pm.max_spare_servers": "4",
        }
    nginx_test = run(["nginx", "-t"], check=False)
    php_fpm_check = command_stdout(["systemctl", "is-active", "lshttpd"]) or command_stdout(["systemctl", "is-active", "php-fpm"])
    valkey_ping = command_stdout(["redis-cli", "-h", "127.0.0.1", "PING"]) or command_stdout(["valkey-cli", "-h", "127.0.0.1", "PING"])
    php_version_output = command_stdout([binary, "-v"])
    recent_errors = []
    for log_path in [home / "logs" / "php-error.log", Path(f"/var/log/nginx/ehpanel-{safe_vhost_name(domain)}-error.log")]:
        if log_path.exists():
            recent_errors.extend(log_path.read_text(encoding="utf-8", errors="ignore").splitlines()[-20:])
    return ok(
        username=username,
        domain=domain,
        web_engine=payload.get("web_engine"),
        php_version=payload.get("php_version"),
        home_dir=str(home),
        public_dir=str(public_dir),
        account_logs=str(home / "logs"),
        php_fpm_pool=username,
        php_fpm_sock=f"/run/php-fpm/{username}.sock",
        collected_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        service_state=service_state("nginx", "httpd", "lshttpd", "mariadb", "postgresql", "valkey"),
        php_cli_version=php_version_output.splitlines()[0] if php_version_output else "",
        php_ini=php_ini_path,
        php_modules=php_modules,
        php_ini_values=php_ini_values,
        php_user_ini=user_ini,
        php_fpm_values=php_fpm_values,
        apache_http_directives=(software_dir / "apache-http.conf").read_text(encoding="utf-8", errors="ignore") if (software_dir / "apache-http.conf").exists() else "",
        apache_https_directives=(software_dir / "apache-https.conf").read_text(encoding="utf-8", errors="ignore") if (software_dir / "apache-https.conf").exists() else "",
        nginx_directives=(software_dir / "nginx.conf").read_text(encoding="utf-8", errors="ignore") if (software_dir / "nginx.conf").exists() else "",
        opcache={"enabled": "Zend OPcache" in php_modules or "opcache" in {item.lower() for item in php_modules}, "cli": php_ini_values.get("opcache.enable_cli") == "1"},
        composer_version=command_stdout(["composer", "--version"]),
        node_version=command_stdout(["node", "--version"]),
        pnpm_version=command_stdout(["pnpm", "--version"]),
        python_version=command_stdout(["python3", "--version"]),
        nginx_check=(nginx_test.get("stderr") or nginx_test.get("stdout") or "").strip(),
        php_fpm_check=f"OpenLiteSpeed/php handler: {php_fpm_check}",
        valkey_ping=valkey_ping,
        valkey_ok=valkey_ping == "PONG",
        public_dir_mode=mode_string(public_dir) if public_dir.exists() else "-",
        recent_php_errors=recent_errors[-40:],
    )


def apply_software_settings(payload, settings):
    username = payload["username"]
    validate_username(username)
    home = account_home(payload, settings)
    public_dir = home / "public_html"
    public_dir.mkdir(parents=True, exist_ok=True)
    software_dir = Path("/etc/ehpanel/software") / username
    software_dir.mkdir(parents=True, exist_ok=True)
    php_lines = []
    for key, value in (payload.get("php_settings") or {}).items():
        if value not in [None, ""]:
            php_lines.append(f"{key} = {value}")
    extra = str(payload.get("php_extra_directives") or "").strip()
    if extra:
        php_lines.append("")
        php_lines.append(extra)
    (public_dir / ".user.ini").write_text("\n".join(php_lines).strip() + ("\n" if php_lines else ""), encoding="utf-8")
    for name, content in [
        ("php-fpm.conf", payload.get("php_fpm") or {}),
        ("apache-http.conf", payload.get("apache_http_directives") or ""),
        ("apache-https.conf", payload.get("apache_https_directives") or ""),
        ("nginx.conf", payload.get("nginx_directives") or ""),
    ]:
        target = software_dir / name
        if isinstance(content, dict):
            target.write_text("\n".join(f"{key} = {value}" for key, value in content.items() if value not in [None, ""]) + "\n", encoding="utf-8")
        else:
            target.write_text(str(content), encoding="utf-8")
    installed = []
    skipped = []
    version_digits = re.sub(r"[^0-9]", "", str(payload.get("php_version") or ""))[:2]
    package_map = {"mysqli": "mysqlnd", "pdo_mysql": "mysqlnd", "pdo_pgsql": "pgsql", "redis": "pecl-redis"}
    for extension, enabled in (payload.get("extensions") or {}).items():
        if not enabled:
            skipped.append({"extension": extension, "reason": "disable_not_removed_globally"})
            continue
        if not version_digits:
            skipped.append({"extension": extension, "reason": "php_version_unknown"})
            continue
        suffix = package_map.get(extension, extension)
        candidates = [f"lsphp{version_digits}-{suffix}", f"lsphp{version_digits}-php-{suffix}"]
        result = None
        for package in candidates:
            result = run(["dnf", "-y", "install", package], check=False)
            if result.get("returncode") == 0:
                installed.append(package)
                break
        if result and result.get("returncode") != 0:
            skipped.append({"extension": extension, "reason": "package_not_available", "stderr": result.get("stderr", "")[-300:]})
    run(["chown", "-R", f"{username}:{username}", str(public_dir)], check=False)
    run(["systemctl", "restart", "lshttpd"], check=False)
    run(["nginx", "-t"], check=False)
    run(["systemctl", "reload", "nginx"], check=False)
    return ok(settings_dir=str(software_dir), user_ini=str(public_dir / ".user.ini"), installed_extensions=installed, skipped_extensions=skipped)


def http_probe(url):
    started = time.time()
    result = run(["curl", "-k", "-L", "-o", "/dev/null", "-sS", "-w", "%{http_code}", "--max-time", "8", url], check=False)
    status = (result.get("stdout") or "").strip()
    response_ms = int((time.time() - started) * 1000)
    return {"status": "ok" if status and status[0] in "23" else "failed", "response_ms": response_ms, "message": f"HTTP {status or 'sin respuesta'}"}


def tcp_probe(host, port, timeout=5):
    started = time.time()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return {"status": "ok", "response_ms": int((time.time() - started) * 1000), "message": "Conexion OK"}
    except OSError as exc:
        return {"status": "failed", "response_ms": int((time.time() - started) * 1000), "message": str(exc)}


def ssl_probe(domain):
    started = time.time()
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=6) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as tls:
                cert = tls.getpeercert()
        return {"status": "ok", "response_ms": int((time.time() - started) * 1000), "message": cert.get("notAfter", "SSL OK")}
    except Exception as exc:
        return {"status": "failed", "response_ms": int((time.time() - started) * 1000), "message": str(exc)}


def tail_file(path, limit=20):
    target = Path(path)
    if not target.exists():
        return []
    result = run(["tail", "-n", str(limit), str(target)], check=False)
    return [line for line in (result.get("stdout") or "").splitlines() if line.strip()]


def parse_nginx_access_line(line):
    match = re.match(r'(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] "(?P<method>\S+)\s+(?P<path>\S+)[^"]*" (?P<code>\d{3}) (?P<bytes>\S+)', line)
    if not match:
        return {"time": "", "method": "", "path": line[:240], "status": "log", "code": "", "detail": line}
    code = int(match.group("code"))
    status = "error" if code >= 500 else ("warning" if code >= 400 else "ok")
    return {
        "time": match.group("time"),
        "method": match.group("method"),
        "path": match.group("path"),
        "status": status,
        "code": code,
        "detail": f'{match.group("ip")} - {match.group("bytes")} bytes',
    }


def collect_monitor_logs(domain):
    safe_domain = safe_vhost_name(domain)
    access_lines = []
    for suffix in ["ssl-access", "access"]:
        access_lines.extend(tail_file(f"/var/log/nginx/ehpanel-{safe_domain}-{suffix}.log", 20))
    error_lines = tail_file(f"/var/log/nginx/ehpanel-{safe_domain}-ssl-error.log", 10) + tail_file(f"/var/log/nginx/ehpanel-{safe_domain}-error.log", 10)
    web = [parse_nginx_access_line(line) for line in access_lines[-20:]]
    web.extend({"time": "", "method": "", "path": "nginx error", "status": "error", "code": 500, "detail": line} for line in error_lines[-10:])
    mail = [
        {"time": "", "from": "", "to": "", "direction": "smtp", "status": "log", "code": "", "detail": line}
        for line in tail_file("/var/log/maillog", 20) or command_stdout(["journalctl", "-u", "postfix", "-n", "20", "--no-pager"]).splitlines()
    ]
    system = [
        {"time": "", "service": "", "severity": "info", "event": line, "suggestion": ""}
        for line in command_stdout(["journalctl", "-n", "20", "--no-pager"]).splitlines()
    ]
    return {"web": web[-30:], "mail": mail[-20:], "system": system[-20:]}


def collect_account_monitoring(payload):
    domain = validate_domain(payload["domain"])
    http = http_probe(f"https://{domain}")
    dns = {"status": "ok", "response_ms": 0, "message": command_stdout(["getent", "hosts", domain]) or "Sin respuesta DNS"}
    if not dns["message"] or dns["message"] == "Sin respuesta DNS":
        dns["status"] = "failed"
    ssl_result = ssl_probe(domain)
    smtp = tcp_probe(f"mail.{domain}", 25)
    webmail = http_probe(f"https://webmail.{domain}")
    checks = [
        {"type": "http", "name": "HTTP / HTTPS", "target": f"https://{domain}", **http},
        {"type": "dns", "name": "DNS", "target": domain, **dns},
        {"type": "ssl", "name": "SSL", "target": domain, **ssl_result},
        {"type": "smtp", "name": "SMTP", "target": f"mail.{domain}:25", **smtp},
        {"type": "webmail", "name": "Webmail", "target": f"https://webmail.{domain}", **webmail},
    ]
    services = [
        {"name": name, "status": data["status"], "active": data["active"]}
        for name, data in service_state("nginx", "lshttpd", "mariadb", "postgresql", "postfix", "dovecot", "rspamd", "ehpanel-webmail").items()
    ]
    failed = sum(1 for item in checks if item["status"] == "failed")
    avg_ms = int(sum(item.get("response_ms", 0) for item in checks) / max(1, len(checks)))
    logs = collect_monitor_logs(domain)
    return ok(
        summary={"status": "down" if failed else "operational", "uptime_pct": 99.9 if failed else 100, "response_ms": avg_ms},
        checks=checks,
        services=services,
        logs=logs,
        sla={"uptime_pct": 99.9 if failed else 100, "incidents": failed, "downtime_minutes": 0 if not failed else 1, "mttr_minutes": 0},
        history=[{"time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "status": "down" if failed else "operational", "response_ms": avg_ms, "incidents_open": failed}],
    )


def main():
    try:
        request = json.loads(sys.stdin.read() or "{}")
        job_type = request["job_type"]
        payload = request.get("payload") or {}
        settings = request.get("settings") or {}
        if job_type in {"provision_hosting", "provision_openlitespeed_hosting"}:
            return provision_hosting(payload, settings)
        if job_type == "create_sftp_user":
            ensure_user(payload["username"], payload.get("password", ""), settings["home_root"])
            return ok(username=payload["username"])
        if job_type == "create_ftp_user":
            return create_ftp_user(payload, settings)
        if job_type == "delete_ftp_user":
            return delete_ftp_user(payload, settings)
        if job_type == "suspend_ftp_user":
            return account_lock(payload, True)
        if job_type == "unsuspend_ftp_user":
            return account_lock(payload, False)
        if job_type == "create_dns_zone":
            return create_dns_zone(payload, settings)
        if job_type == "issue_ssl":
            return issue_ssl(payload, settings)
        if job_type in {"create_database", "create_database_user"}:
            return create_database(payload)
        if job_type == "install_wordpress":
            return install_wordpress_app(payload, settings)
        if job_type == "install_moodle":
            return install_moodle_app(payload, settings)
        if job_type == "deploy_node_app":
            return deploy_node_app(payload, settings)
        if job_type == "deploy_django_app":
            return deploy_django_app(payload, settings)
        if job_type == "deploy_laravel_app":
            return deploy_laravel_app(payload, settings)
        if job_type == "wordpress_toolkit":
            return wordpress_toolkit(payload, settings)
        if job_type == "node_toolkit":
            return node_toolkit(payload, settings)
        if job_type == "python_toolkit":
            return python_toolkit(payload, settings)
        if job_type == "laravel_toolkit":
            return laravel_toolkit(payload, settings)
        if job_type == "collect_app_logs":
            return collect_app_logs(payload, settings)
        if job_type == "create_mail_domain":
            return create_mail_domain(payload, settings)
        if job_type == "configure_webmail_domain":
            return configure_webmail_domain(payload, settings)
        if job_type == "create_mailbox":
            return create_mailbox(payload, settings)
        if job_type == "change_mailbox_password":
            return change_mailbox_password(payload, settings)
        if job_type == "set_mailbox_quota":
            return set_mailbox_quota(payload)
        if job_type == "suspend_mailbox":
            return suspend_mailbox(payload, True)
        if job_type == "unsuspend_mailbox":
            return suspend_mailbox(payload, False)
        if job_type == "delete_mailbox":
            return delete_mailbox(payload, settings)
        if job_type == "set_mailbox_antispam":
            return mailbox_json_job(payload, ".ehpanel-antispam.json")
        if job_type == "set_mailbox_autoresponder":
            return mailbox_json_job(payload, ".ehpanel-autoresponder.json")
        if job_type == "collect_software_info":
            return collect_software_info(payload, settings)
        if job_type == "apply_software_settings":
            return apply_software_settings(payload, settings)
        if job_type == "run_web_performance_audit":
            return run_web_performance_audit(payload, settings)
        if job_type == "collect_account_monitoring":
            return collect_account_monitoring(payload)
        if job_type == "file_list":
            return file_list(payload, settings)
        if job_type == "file_read":
            return file_read(payload, settings)
        if job_type == "file_write":
            return file_write(payload, settings)
        if job_type == "file_upload":
            return file_upload(payload, settings)
        if job_type == "file_import_url":
            return file_import_url(payload, settings)
        if job_type == "file_delete":
            return file_delete(payload, settings)
        if job_type == "file_copy":
            return file_copy(payload, settings)
        if job_type == "file_move":
            return file_move(payload, settings)
        if job_type == "file_mkdir":
            return file_mkdir(payload, settings)
        if job_type == "file_chmod":
            return file_chmod(payload, settings)
        if job_type == "file_compress":
            return file_compress(payload, settings)
        if job_type == "file_extract":
            return file_extract(payload, settings)
        if job_type == "file_download":
            return file_download(payload, settings)
        if job_type == "suspend_account":
            return account_lock(payload, True)
        if job_type == "unsuspend_account":
            return account_lock(payload, False)
        if job_type == "delete_account":
            return account_lock(payload, True)
        if job_type == "service_action":
            return service_action(payload, settings)
        return fail("UNSUPPORTED_JOB_TYPE", f"Job no soportado por provisionamiento local: {job_type}")
    except Exception as exc:
        return fail("LOCAL_PROVISIONING_ERROR", str(exc))


if __name__ == "__main__":
    raise SystemExit(main())
