# Objetivo
Auditoría de seguridad completa del panel de hosting.
Stack: Django 5 + DRF + ReactJS. AlmaLinux, systemd, sin Docker.

## Alcance
- settings.py y configuración
- Todos los endpoints DRF (views, serializers, permissions)
- Modelos y queries (SQLi, IDOR)
- CORS / CSRF config
- Variables de entorno y secretos expuestos
- nginx.conf si existe