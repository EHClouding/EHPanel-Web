# EHPanel Web

EHPanel Web es el panel de hosting web por nodo de EHClouding. Esta version esta
pensada para instalarse en cada VPS web, por ejemplo `web01`, `web02`, `web03`,
y ejecutar el provisionamiento directamente contra los servicios locales del
servidor.

Repositorio:

```text
https://github.com/EHClouding/EHPanel-Web.git
```

## Estado del proyecto

| Area | Estado | Notas |
| --- | --- | --- |
| Panel web | Funcional | Django + DRF + Channels + React/Vite. |
| Provisionamiento | Local | No depende del agente Go para crear cuentas, correos, SSL, apps o archivos. |
| Motor hosting | Funcional | Nginx como edge y OpenLiteSpeed como hosting principal. |
| PHP | Funcional | LSPHP 8.3, 8.4 y 8.5 detectados desde OpenLiteSpeed. |
| Correo | Funcional | Postfix + Dovecot + Rspamd + webmail EHPanel. |
| Bases de datos | Funcional | MariaDB, PostgreSQL, phpMyAdmin y Adminer con SSO. |
| Apps | Funcional base | WordPress, Laravel, Node.js, Python/Django via jobs locales. |
| Billing API | Implementada | Contrato `/api/v1/billing/...` listo para EHPanel Billing. |
| Agente Go | No requerido para hosting critico | Queda reservado para monitoreo, actualizaciones y funciones futuras. |
| Ansible | Requerido para produccion | El stack completo se despliega desde EHPanel-Ansible. |

## Arquitectura

### Modelo actual

```text
VPS Principal
  - EHPanel Core: panel privado interno
  - EHPanel Billing: facturacion y fuente comercial
  - Herramientas internas EHClouding

VPS Web Node
  - EHPanel Web
  - Nginx edge
  - OpenLiteSpeed hosting
  - MariaDB / PostgreSQL
  - Postfix / Dovecot / Rspamd
  - PowerDNS
  - Certbot
  - EHPanel Webmail
```

### Responsabilidades

| Componente | Responsabilidad | No debe hacer |
| --- | --- | --- |
| EHPanel Billing | Crear ordenes, suspender, cambiar plan, consultar uso, eliminar servicio. | Provisionar directamente en Linux. |
| EHPanel Web | Ejecutar hosting real en el nodo: cuentas, dominios, SSL, mail, DB, apps, archivos. | Depender de Core para provisionar. |
| EHPanel Core | Panel privado interno de administracion general. | Ser intermediario obligatorio de provisionamiento publico. |
| EHPanel Agent Go | Monitoreo, actualizaciones, mantenimiento futuro. | Ser requisito para altas de hosting en esta fase. |
| EHPanel Ansible | Instalar y configurar el nodo completo. | Guardar secretos sin cifrar. |

## Stack tecnico

| Capa | Tecnologia |
| --- | --- |
| Backend | Python, Django 5, Django REST Framework, Channels |
| Frontend | React 19, TypeScript, Vite, pnpm |
| ASGI | Daphne |
| Base de datos del panel | PostgreSQL |
| Cache / channel layer | Valkey o Redis compatible |
| Edge web | Nginx |
| Hosting web | OpenLiteSpeed |
| PHP hosting | LSPHP 8.3, 8.4, 8.5 |
| SQL cliente | MariaDB, PostgreSQL |
| DB tools | phpMyAdmin, Adminer |
| Correo | Postfix, Dovecot, Rspamd |
| DNS | PowerDNS Authoritative |
| SSL | Certbot / Let's Encrypt |
| Webmail | EHPanel Webmail |
| Provisionamiento local | `/usr/local/sbin/ehpanel-local-provision` |

## Estructura del repositorio

```text
EHPanel-Web/
  agents/                 Codigo heredado de nodos/agente y jobs.
  deploy/dbtools/         SSO PHP para phpMyAdmin/Adminer.
  docs/                   Documentacion tecnica adicional.
  ehpanel_web/            Settings, ASGI, URLs y auth base.
  frontend/               React/Vite client/admin/reseller UI.
  hosting/                Modelos, APIs, servicios y provisionamiento hosting.
  scripts/
    deploy.sh             Script de update controlado.
    ehpanel-local-provision.py
                           Helper local ejecutado con sudo en el nodo.
  requirements.txt        Dependencias Python.
  .env.example            Variables base del panel.
```

## Requisitos de servidor

| Requisito | Valor recomendado |
| --- | --- |
| OS | AlmaLinux 10 minimal |
| Acceso | root por SSH para instalacion inicial |
| RAM | 4 GB minimo, 8 GB recomendado |
| Disco | 40 GB minimo para pruebas, mas segun clientes |
| CPU | 2 vCPU minimo, 4 vCPU recomendado |
| IPv4 publica | Requerida |
| Dominio panel | A/AAAA apuntando al VPS antes de SSL |
| DNS cliente | Dominios apuntando al nodo antes de emitir SSL real |

## Puertos

| Puerto | Servicio | Uso |
| --- | --- | --- |
| 22/tcp | SSH | Administracion |
| 53/tcp, 53/udp | PowerDNS | DNS autoritativo |
| 80/tcp | Nginx / ACME | HTTP y validacion Let's Encrypt |
| 443/tcp | Nginx | HTTPS panel y sitios |
| 25/tcp | Postfix | SMTP entrante |
| 465/tcp | Postfix | SMTPS |
| 587/tcp | Postfix | Submission |
| 993/tcp | Dovecot | IMAPS |
| 995/tcp | Dovecot | POP3S |
| 8004/tcp local | EHPanel Web | Backend interno, no publico |
| 8012/tcp local | EHPanel Webmail | Backend interno, no publico |
| 8088/tcp local | OpenLiteSpeed backend | Backend interno de hosting |

## Variables de entorno principales

El archivo real en produccion vive normalmente en:

```text
/etc/ehpanel/ehpanel-web.env
```

| Variable | Ejemplo | Descripcion |
| --- | --- | --- |
| `DEBUG` | `false` | Siempre `false` en produccion. |
| `SECRET_KEY` | valor aleatorio largo | Clave Django. Debe rotarse por servidor. |
| `ALLOWED_HOSTS` | `web01.ehclouding.com,localhost,127.0.0.1` | Hosts aceptados por Django. |
| `CSRF_TRUSTED_ORIGINS` | `https://web01.ehclouding.com` | Origen HTTPS del panel. |
| `DATABASE_URL` | `postgres://ehpanel_web:PASS@127.0.0.1:5432/ehpanel_web` | DB del panel. |
| `REDIS_URL` | `redis://127.0.0.1:6379/0` | Valkey/Redis para cache y Channels. |
| `INTERNAL_BILLING_API_TOKEN` | token compartido | Token que Billing usa contra Web. |
| `BILLING_API_BASE` | `https://billing.ehclouding.com/api/v1` | API saliente hacia Billing, si aplica. |
| `BILLING_API_TOKEN` | token billing | Token saliente hacia Billing, si aplica. |
| `HOSTING_PROVISIONING_MODE` | `local` | Debe ser `local` en el modelo por nodo. |
| `HOSTING_DEFAULT_WEB_ENGINE` | `openlitespeed` | Motor por defecto. |
| `LOCAL_PANEL_HOSTNAME` | `web01.ehclouding.com` | Identidad del nodo. |
| `LOCAL_PUBLIC_IP` | `203.0.113.10` | IP publica del nodo. |
| `LOCAL_PROVISIONING_HELPER` | `/usr/local/sbin/ehpanel-local-provision` | Helper local. |
| `LOCAL_PROVISIONING_SUDO` | `true` | Ejecuta helper con sudo. |
| `LOCAL_PROVISION_SSL` | `true` | Permite emitir SSL desde provisionamiento. |
| `LOCAL_PROVISION_MAIL` | `true` | Permite configurar correo local. |
| `LOCAL_MOODLE_DOWNLOAD_URL` | vacio | Override opcional del paquete Moodle; si queda vacio usa el paquete oficial estable definido en el helper. |
| `LOCAL_WEBMAIL_ENABLED` | `true` | Activa webmail por cuenta. |
| `WEBMAIL_SSO_SECRET` | valor aleatorio | SSO panel -> webmail. |
| `DBTOOLS_SSO_SECRET` | valor aleatorio | SSO panel -> phpMyAdmin/Adminer. |
| `DBTOOLS_CREDENTIAL_KEY` | valor aleatorio | Cifrado de credenciales DB. |

Nunca subir `.env`, `ehpanel-web.env`, vaults, tokens ni llaves privadas al
repositorio.

## Despliegue recomendado con Ansible

El despliegue productivo no debe hacerse archivo por archivo. El camino
recomendado es EHPanel-Ansible, que instala el nodo completo: paquetes, Nginx,
OpenLiteSpeed, PHP, bases de datos, correo, DNS, firewall, webmail y EHPanel Web.

Repositorio local usado durante la fase de pruebas:

```text
D:\EHCLOUDINGV2\Ansible
```

### 1. Preparar dependencias en la maquina de control

```bash
cd EHPanel-Ansible
python -m venv .venv
. .venv/bin/activate
pip install "ansible>=2.17"
ansible-galaxy collection install -r requirements.yml
```

Tambien se puede usar:

```bash
make deps
```

### 2. Configurar inventario

Editar el inventario correspondiente:

```text
inventories/staging/hosts.yml
inventories/production/hosts.yml
```

Ejemplo conceptual:

```yaml
all:
  children:
    web_nodes:
      hosts:
        web01.ehclouding.com:
          ansible_host: 203.0.113.10
          ansible_user: root
```

### 3. Configurar variables del host

Variables importantes del rol `ehpanel_web_panel`:

| Variable Ansible | Descripcion |
| --- | --- |
| `ehpanel_web_panel_domain` | Dominio publico del panel en el nodo. |
| `ehpanel_web_panel_public_url` | URL publica HTTPS del panel. |
| `ehpanel_web_panel_source_path` | Ruta local/remota desde donde copiar el codigo. |
| `ehpanel_web_panel_secret_key` | `SECRET_KEY` de Django. |
| `ehpanel_web_panel_database_url` | Conexion PostgreSQL del panel. |
| `ehpanel_web_panel_redis_url` | Conexion Valkey/Redis. |
| `ehpanel_web_panel_billing_token` | Token compartido con Billing. |
| `ehpanel_web_panel_local_public_ip` | IP publica del nodo. |
| `ehpanel_web_panel_provision_dns` | Activa provisionamiento DNS local. |
| `ehpanel_web_panel_provision_ssl` | Activa provisionamiento SSL local. |
| `ehpanel_web_panel_provision_mail` | Activa provisionamiento mail local. |
| `ehpanel_web_panel_local_webmail_enabled` | Activa EHPanel Webmail. |
| `ehagent_enabled` | Debe quedar `false` para esta fase. |

Los secretos deben ir en `vault.yml` cifrado:

```bash
ansible-vault encrypt inventories/production/host_vars/web01.ehclouding.com/vault.yml
ansible-vault edit inventories/production/host_vars/web01.ehclouding.com/vault.yml
```

### 4. Ejecutar dry-run

```bash
ansible-playbook -i inventories/production/hosts.yml \
  playbooks/web-node.yml \
  --check --diff \
  --ask-vault-pass
```

### 5. Aplicar despliegue

```bash
ansible-playbook -i inventories/production/hosts.yml \
  playbooks/web-node.yml \
  --ask-vault-pass
```

### 6. Validar nodo

```bash
ansible-playbook -i inventories/production/hosts.yml \
  playbooks/validate.yml \
  --ask-vault-pass
```

## Despliegue/update desde checkout Git

El script `scripts/deploy.sh` sirve para actualizar una instalacion existente.
En produccion debe ejecutarse con variables explicitas porque el layout actual
de Ansible usa `/opt/ehpanel/web`.

```bash
cd /opt/ehpanel/web

EHPANEL_WEB_DEPLOY_DIR=/opt/ehpanel/web \
EHPANEL_WEB_VENV_DIR=/opt/ehpanel/web/.venv \
EHPANEL_WEB_SERVICE_NAME=ehpanel-web \
EHPANEL_WEB_BRANCH=main \
EHPANEL_WEB_HEALTH_URL=http://127.0.0.1:8004/health/ \
EHPANEL_WEB_REQUIRE_GIT_UPDATE=true \
./scripts/deploy.sh
```

El script realiza:

| Paso | Accion |
| --- | --- |
| 1 | Crea snapshot local antes de tocar archivos. |
| 2 | Hace `git fetch` y `git reset --hard origin/main`. |
| 3 | Instala dependencias Python. |
| 4 | Detiene `ehpanel-web`. |
| 5 | Ejecuta migraciones. |
| 6 | Ejecuta `manage.py check`. |
| 7 | Construye frontend con pnpm. |
| 8 | Reinicia servicio. |
| 9 | Valida `/health/`. |
| 10 | Hace rollback si falla un paso critico. |

## Desarrollo local

### Backend

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
daphne -b 127.0.0.1 -p 8004 ehpanel_web.asgi:application
```

### Frontend

Usar pnpm, no npm.

```bash
cd frontend
pnpm install
pnpm run build
pnpm exec vite --host 127.0.0.1 --port 5173
```

Para desarrollo con backend separado, configurar `VITE_API_URL` si corresponde.

## Validaciones antes de subir cambios

```bash
python -m py_compile hosting/views.py
python manage.py check

cd frontend
pnpm run build
```

En un servidor desplegado:

```bash
systemctl status ehpanel-web --no-pager
systemctl is-active nginx
systemctl is-active lshttpd
systemctl is-active postgresql
systemctl is-active mariadb
systemctl is-active postfix
systemctl is-active dovecot
systemctl is-active rspamd
systemctl is-active valkey
curl -fsS http://127.0.0.1:8004/health/
```

## Contrato Billing

EHPanel Web expone el contrato estable en:

```text
/api/v1/billing/...
```

Tambien existen alias internos:

```text
/api/integrations/billing/...
/api/billing/...
```

El contrato publico para Billing debe mantenerse en `/api/v1/billing/...`.

| Endpoint | Metodo | Uso |
| --- | --- | --- |
| `/api/v1/billing/auth/check/` | GET/POST | Validar token/API key. |
| `/api/v1/billing/health/` | GET | Salud del panel web. |
| `/api/v1/billing/node/summary/` | GET | Resumen del nodo. |
| `/api/v1/billing/telemetry/` | GET | Alias de telemetria basica. |
| `/api/v1/billing/plans/active/` | GET | Planes activos disponibles. |
| `/api/v1/billing/services/provision/` | POST | Crear cuenta hosting. |
| `/api/v1/billing/services/{id}/` | GET | Detalle de servicio. |
| `/api/v1/billing/services/{id}/status/` | GET | Estado de servicio. |
| `/api/v1/billing/services/{id}/suspend/` | POST | Suspender servicio. |
| `/api/v1/billing/services/{id}/unsuspend/` | POST | Reactivar servicio. |
| `/api/v1/billing/services/{id}/terminate/` | POST | Eliminar servicio. |
| `/api/v1/billing/services/{id}/change-password/` | POST | Cambiar password principal. |
| `/api/v1/billing/services/{id}/change-plan/` | POST | Cambiar plan/recursos. |
| `/api/v1/billing/services/{id}/usage/` | GET | Uso basico para Billing. |

Autenticacion:

```http
Authorization: Bearer INTERNAL_BILLING_API_TOKEN
```

o el esquema soportado por el cliente Billing configurado. El token debe ser
un secreto compartido unico por entorno.

## Provisionamiento local

El backend crea jobs `AgentJob`, pero en modo local se ejecutan con:

```text
/usr/local/sbin/ehpanel-local-provision
```

Esto mantiene compatibilidad con el modelo de jobs sin depender del agente Go.

| Job | Accion real |
| --- | --- |
| Crear cuenta | Usuario Linux, home, vhost, OpenLiteSpeed/Nginx, limites base. |
| Suspender/reactivar | Cambios de estado y bloqueo/desbloqueo de cuenta. |
| Eliminar | Baja tecnica de recursos locales. |
| SSL | Certbot con validacion DNS previa y SANs disponibles. |
| Mail | Dominios, mailboxes, Dovecot passwd-file, Postfix maps. |
| DB | MariaDB/PostgreSQL, usuarios, passwords, permisos. |
| Archivos | Listar, leer, escribir, subir, comprimir, extraer, mover. |
| Apps | WordPress, Laravel, Node.js, Python/Django. |
| Software | PHP, extensiones, settings, auditoria de rendimiento. |
| Servicios | Acciones controladas sobre servicios permitidos. |

## Operacion diaria

### Reiniciar OpenLiteSpeed desde cliente

El cliente tiene una accion en `Software > OpenLiteSpeed` y un aviso contextual
en `Archivos` cuando guarda o sube `.htaccess`.

Alcance real:

| Accion | Alcance |
| --- | --- |
| Reinicio `lshttpd` | Global al nodo. Puede afectar por segundos a otros sitios OpenLiteSpeed. |
| Cambio PHP por cuenta | Se aplica a la cuenta y su vhost. |
| `.user.ini` / OPcache | Puede requerir recarga o limpieza especifica. |

Por eso la accion no se ejecuta automaticamente en cada guardado de `.htaccess`
y tiene limite de frecuencia.

### SSL

Antes de emitir SSL real:

1. El dominio principal debe resolver a la IP publica del nodo.
2. `www` debe resolver si se desea incluirlo.
3. `webmail.dominio.com` debe resolver si webmail esta activo.
4. Alias sin DNS publico se omiten para evitar romper la emision.

Validar:

```bash
dig +short dominio.com
dig +short www.dominio.com
dig +short webmail.dominio.com
certbot certificates
```

### Webmail

El webmail integrado se publica por cuenta como:

```text
https://webmail.dominio-cliente.com
```

Requiere:

| Requisito | Detalle |
| --- | --- |
| DNS | `webmail` apuntando al nodo. |
| SSL | Certificado para `webmail.dominio`. |
| Mailbox | Cuenta creada en EHPanel Web. |
| Dovecot | IMAP activo y autenticando. |
| Postfix | Recepcion/envio local configurado. |
| SSO | `WEBMAIL_SSO_SECRET` sincronizado con webmail. |

### phpMyAdmin y Adminer

El acceso se realiza por SSO temporal desde el panel. Si el navegador muestra
codigo PHP como texto, revisar Apache/httpd y handler PHP:

```bash
systemctl restart httpd
curl -I https://PANEL/ehpanel-dbtools/sso.php
```

Debe ejecutar PHP, no servir el archivo como texto plano.

## Checklist de pruebas funcionales

Despues de instalar un nodo nuevo:

| # | Prueba | Resultado esperado |
| --- | --- | --- |
| 1 | Login admin | Acceso correcto al panel. |
| 2 | Crear plan | Plan con PHP 8.3, 8.4, 8.5 y OpenLiteSpeed. |
| 3 | Crear cuenta | Usuario, vhost y home creados. |
| 4 | Emitir SSL | Certificado activo para dominio con DNS correcto. |
| 5 | Crear dominio adicional | Dominio agregado y rutas visibles. |
| 6 | Crear subdominio | Subdominio provisionado. |
| 7 | Crear correo | Mailbox creada y login webmail correcto. |
| 8 | Enviar correo | SMTP acepta envio autenticado. |
| 9 | Recibir correo | Postfix recibe para dominio local. |
| 10 | Crear MariaDB | DB y usuario creados. |
| 11 | Abrir phpMyAdmin | SSO entra sin mostrar codigo fuente. |
| 12 | Crear PostgreSQL | DB y usuario creados. |
| 13 | Abrir Adminer | SSO entra con credenciales correctas. |
| 14 | Archivos | Listar, subir, editar, comprimir, extraer. |
| 15 | `.htaccess` | Guardar y aplicar cambios OpenLiteSpeed. |
| 16 | FTP/SFTP | Usuario creado y acceso correcto. |
| 17 | WordPress | Instalacion y acceso. |
| 18 | Laravel | Deploy base. |
| 19 | Node.js | Deploy base y servicio activo. |
| 20 | Django/Python | Deploy base y servicio activo. |
| 21 | Software | PHP, extensiones, runtime y auditoria. |
| 22 | Monitoreo | Metricas y logs con datos reales. |
| 23 | Avanzado | Git, SSH keys, cron, env vars, redirects, headers, webhooks, jobs. |
| 24 | Billing health | `/api/v1/billing/health/` responde OK. |

## Troubleshooting rapido

| Sintoma | Causa probable | Accion |
| --- | --- | --- |
| `SECRET_KEY must be set` | No se cargo `/etc/ehpanel/ehpanel-web.env`. | Revisar systemd `EnvironmentFile`. |
| `No module named django` | Python incorrecto. | Usar `/opt/ehpanel/web/.venv/bin/python`. |
| PHP versions en blanco | No se detectan `lsphp*`. | Revisar `/usr/local/lsws/lsphp*/bin/php`. |
| Motor web en problemas | Servicio incorrecto. | Debe validar `lshttpd`, no `lsws`. |
| SSL falla sin enviar solicitud | SAN con DNS inexistente. | Validar DNS; el helper debe omitir alias sin respuesta publica. |
| Webmail dice credenciales incorrectas | Dovecot/passwd-file no sincronizado. | Revisar mailbox y `/etc/dovecot/ehpanel-users`. |
| SMTP `Relay access denied` | Dominio/mailbox no registrado o envio no autenticado. | Revisar Postfix maps y submission 587. |
| phpMyAdmin muestra PHP fuente | Apache no ejecuta PHP para dbtools. | Reiniciar `httpd` y revisar handler. |
| Archivos no cargan | Helper local o permisos de home. | Revisar job y logs de provisionamiento. |
| `Given token not valid` | JWT expirado en frontend. | Reautenticar y revisar refresh token. |

## Comandos utiles en servidor

```bash
cd /opt/ehpanel/web
set -a
. /etc/ehpanel/ehpanel-web.env
set +a

.venv/bin/python manage.py check
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py shell

systemctl status ehpanel-web --no-pager
systemctl status ehpanel-web-metrics --no-pager
systemctl status nginx --no-pager
systemctl status lshttpd --no-pager
systemctl status httpd --no-pager
systemctl status postfix --no-pager
systemctl status dovecot --no-pager
journalctl -u ehpanel-web -n 200 --no-pager
journalctl -u lshttpd -n 100 --no-pager
```

## Seguridad

| Regla | Motivo |
| --- | --- |
| No commitear secretos. | Evita exponer tokens, passwords y llaves. |
| Usar Ansible Vault. | Mantiene secretos versionables de forma cifrada. |
| Rotar tokens por entorno. | Staging y produccion no deben compartir credenciales. |
| Mantener `DEBUG=false`. | Evita fuga de trazas y settings. |
| Limitar sudo del helper. | El panel solo debe ejecutar comandos permitidos. |
| Revisar logs antes de borrar recursos. | Evita eliminar datos de clientes por error. |
| No usar Core para provisionar. | Mantiene separacion de responsabilidades. |

## Relacion con otros repos

| Repositorio | Uso |
| --- | --- |
| `EHClouding/EHPanel-Web` | Panel web por nodo. |
| `EHPanel-Ansible` | Instalador completo de nodos web. |
| `EHPanel-Billing` | Facturacion y ordenes comerciales. |
| `EHPanel-Webmail` | Webmail integrado por subdominio del cliente. |
| `EHPanel-Agent-Web` | Agente Go futuro para monitoreo/updates, no provisionamiento critico. |
| `EHPanel-Core` | Panel privado interno. |

## Flujo recomendado para produccion

1. Crear VPS definitivo con AlmaLinux 10.
2. Apuntar hostname del panel al VPS.
3. Configurar inventario y vault en Ansible.
4. Ejecutar dry-run.
5. Ejecutar playbook real.
6. Validar servicios y `/health/`.
7. Crear admin inicial.
8. Crear plan real.
9. Crear cuenta real de prueba.
10. Probar SSL, correo, DB, archivos, FTP, WordPress y webmail.
11. Conectar EHPanel Billing usando `/api/v1/billing/...`.
12. Activar backups reales antes de clientes finales.

## Notas de mantenimiento

- El frontend se administra con pnpm.
- OpenLiteSpeed usa servicio `lshttpd`.
- El reinicio de OpenLiteSpeed es global al nodo; usarlo solo cuando sea
  necesario.
- El contrato Billing no debe cambiar de ruta sin coordinar con Billing.
- El modo local es el modo objetivo para los nodos web actuales.
- El agente Go queda fuera del camino critico hasta que se implemente monitoreo
  y actualizaciones.
