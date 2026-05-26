#!/usr/bin/env bash
# EHPanel Web staging deploy.
#
# This script is designed to be executed by Server0 through the Deploy Update
# action. In staging it tolerates missing GitHub credentials so the pipeline can
# be tested with the already deployed checkout. Set REQUIRE_GIT_UPDATE=true in
# production to fail when the repository cannot be updated.

set -euo pipefail

DEPLOY_DIR="${EHPANEL_WEB_DEPLOY_DIR:-/opt/ehpanel-web}"
VENV_DIR="${EHPANEL_WEB_VENV_DIR:-${DEPLOY_DIR}/venv}"
SERVICE_NAME="${EHPANEL_WEB_SERVICE_NAME:-ehpanel-web}"
BRANCH="${EHPANEL_WEB_BRANCH:-main}"
HEALTH_URL="${EHPANEL_WEB_HEALTH_URL:-http://127.0.0.1:8004/health/}"
REQUIRE_GIT_UPDATE="${EHPANEL_WEB_REQUIRE_GIT_UPDATE:-false}"
SNAPSHOT_ROOT="${EHPANEL_WEB_SNAPSHOT_ROOT:-${DEPLOY_DIR}/__snapshots}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
SNAPSHOT_DIR="${SNAPSHOT_ROOT}/${TIMESTAMP}"
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"
export CI="${CI:-true}"

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

rollback() {
  log "Rolling back from ${SNAPSHOT_DIR}"
  if [[ -d "${SNAPSHOT_DIR}/app" ]]; then
    rsync -a --delete \
      --exclude ".env" \
      --exclude "venv/" \
      --exclude "db.sqlite3" \
      --exclude "__snapshots/" \
      "${SNAPSHOT_DIR}/app/" "${DEPLOY_DIR}/"
  fi
  systemctl restart "${SERVICE_NAME}"
}

trap 'log "Deploy failed"; rollback; exit 1' ERR

log "Starting EHPanel Web deploy"
cd "${DEPLOY_DIR}"

log "Creating snapshot ${SNAPSHOT_DIR}"
mkdir -p "${SNAPSHOT_DIR}/app"
rsync -a \
  --exclude ".env" \
  --exclude "venv/" \
  --exclude "db.sqlite3" \
  --exclude "__snapshots/" \
  "${DEPLOY_DIR}/" "${SNAPSHOT_DIR}/app/"

if [[ -d ".git" ]]; then
  log "Fetching origin/${BRANCH}"
  if git fetch origin "${BRANCH}"; then
    log "Resetting checkout to origin/${BRANCH}"
    git reset --hard "origin/${BRANCH}"
  else
    if [[ "${REQUIRE_GIT_UPDATE}" == "true" ]]; then
      log "Git update failed and REQUIRE_GIT_UPDATE=true"
      exit 1
    fi
    log "WARNING: Git update failed; continuing with current staging checkout"
  fi
else
  if [[ "${REQUIRE_GIT_UPDATE}" == "true" ]]; then
    log "No .git directory found and REQUIRE_GIT_UPDATE=true"
    exit 1
  fi
  log "WARNING: No .git directory found; continuing with current files"
fi

log "Installing Python dependencies"
"${VENV_DIR}/bin/pip" install -r requirements.txt --quiet

log "Stopping ${SERVICE_NAME} before migrations"
systemctl stop "${SERVICE_NAME}" || true
sleep 2

log "Running Django migrations"
"${VENV_DIR}/bin/python" manage.py migrate --noinput

log "Running Django system check"
"${VENV_DIR}/bin/python" manage.py check

if [[ -f "frontend/package.json" ]]; then
  log "Building frontend"
  if ! command -v pnpm >/dev/null 2>&1; then
    log "pnpm is required for frontend builds. Install pinned pnpm before deploying."
    exit 1
  fi
  (cd frontend && pnpm install --frozen-lockfile --reporter=silent && pnpm run build)
fi

log "Restarting ${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

log "Waiting for healthcheck ${HEALTH_URL}"
for i in {1..15}; do
  if curl -fsS "${HEALTH_URL}" >/dev/null; then
    log "Healthcheck passed"
    trap - ERR
    log "Deploy complete"
    exit 0
  fi
  sleep 2
done

log "Healthcheck failed"
exit 1
