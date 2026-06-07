#!/usr/bin/env python3
import fcntl
import os
import pwd
import re
import select
import signal
import struct
import subprocess
import sys
import termios
from pathlib import Path


SAFE_USER = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")


def fail(message, code=1):
    sys.stdout.write(f"\r\n[EHPanel terminal] {message}\r\n")
    sys.stdout.flush()
    raise SystemExit(code)


def safe_target(username, cwd):
    if not SAFE_USER.match(username or ""):
        fail("Usuario invalido.")
    try:
        user_info = pwd.getpwnam(username)
    except KeyError:
        fail("Usuario no existe.")
    home = Path(user_info.pw_dir or f"/home/{username}").resolve(strict=False)
    requested = str(cwd or "/").strip().replace("\\", "/")
    if not requested or requested == ".":
        requested = "/"
    rel = requested.lstrip("/")
    target = (home / rel).resolve(strict=False)
    if os.path.commonpath([str(home), str(target)]) != str(home):
        fail("Ruta fuera de la cuenta.")
    if not target.exists() or not target.is_dir():
        fail("El directorio de trabajo no existe.")
    return user_info, home, target


def bounded_int(value, minimum, maximum, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def resize(fd, cols, rows):
    packed = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, packed)


def demote(user_info):
    os.initgroups(user_info.pw_name, user_info.pw_gid)
    os.setgid(user_info.pw_gid)
    os.setuid(user_info.pw_uid)


def child_preexec(user_info, slave_fd):
    os.setsid()
    try:
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
    except OSError:
        pass
    demote(user_info)


def main():
    if os.geteuid() != 0:
        fail("El broker debe ejecutarse como root.")
    username = sys.argv[1] if len(sys.argv) > 1 else ""
    cwd = sys.argv[2] if len(sys.argv) > 2 else "/"
    cols = bounded_int(sys.argv[3] if len(sys.argv) > 3 else 100, 20, 240, 100)
    rows = bounded_int(sys.argv[4] if len(sys.argv) > 4 else 24, 8, 80, 24)
    user_info, home, target = safe_target(username, cwd)

    master_fd, slave_fd = os.openpty()
    resize(master_fd, cols, rows)
    env = {
        "HOME": str(home),
        "LANG": "C.UTF-8",
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "SHELL": "/bin/bash",
        "TERM": "xterm-256color",
        "USER": username,
    }
    shell_command = (
        "ulimit -u 128; "
        "ulimit -t 3600; "
        "alias sudo='echo sudo no disponible en EHPanel terminal >&2; false'; "
        "exec /bin/bash --noprofile --norc -i"
    )
    child = subprocess.Popen(
        ["/bin/bash", "-lc", shell_command],
        cwd=str(target),
        env=env,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        close_fds=True,
        preexec_fn=lambda: child_preexec(user_info, slave_fd),
    )
    os.close(slave_fd)
    stdin_fd = sys.stdin.fileno()
    stdout_fd = sys.stdout.fileno()

    try:
        stdin_open = True
        while True:
            watch = [master_fd]
            if stdin_open:
                watch.append(stdin_fd)
            readable, _, _ = select.select(watch, [], [], 0.5)
            if master_fd in readable:
                try:
                    data = os.read(master_fd, 4096)
                except OSError:
                    break
                if not data:
                    break
                try:
                    os.write(stdout_fd, data)
                except BrokenPipeError:
                    break
            if stdin_fd in readable:
                data = os.read(stdin_fd, 4096)
                if not data:
                    stdin_open = False
                    try:
                        os.write(master_fd, b"exit\n")
                    except OSError:
                        break
                    continue
                os.write(master_fd, data)
            if child.poll() is not None:
                break
    finally:
        try:
            os.close(master_fd)
        except OSError:
            pass
        if child.poll() is None:
            try:
                child.terminate()
                child.wait(timeout=2)
            except Exception:
                try:
                    os.kill(child.pid, signal.SIGKILL)
                except OSError:
                    pass


if __name__ == "__main__":
    main()
