#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Helmer - Google Cloud Run Clean Build & Deploy Script
# ==============================================================================
# Bu skript layihəni heç bir gizli fayl (.env, data/*.json) daxil olmadan
# Google Cloud Build vasitəsilə buludda təhlükəsiz build edib Cloud Run-a yerləşdirir.
# ==============================================================================

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GOOGLE_CLOUD_REGION:-europe-west3}"
SERVICE_NAME="${SERVICE_NAME:-marketify-ai}"
COMMIT_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${COMMIT_TAG}"

echo "=== 1. Təhlükəsizlik yoxlanışı ==="
if [ ! -f ".dockerignore" ] || ! grep -q "\.env\*" .dockerignore; then
  echo "❌ Xəta: .dockerignore faylında .env* qeydi tapılmadı!"
  exit 1
fi

if [ ! -f ".gcloudignore" ] || ! grep -q "\.env\*" .gcloudignore; then
  echo "❌ Xəta: .gcloudignore faylında .env* qeydi tapılmadı!"
  exit 1
fi
echo "✅ .dockerignore və .gcloudignore təhlükəsizliyi təsdiqləndi (.env* kənarlaşdırılıb)."

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Xəta: GCP Project ID təyin edilməyib. Əvvəlcə 'gcloud config set project <PROJECT_ID>' icra edin."
  exit 1
fi

echo "Layihə: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Servis: ${SERVICE_NAME}"

echo "=== 2. Təmiz Docker Image Build (Google Cloud Build vasitəsilə) ==="
# Lokal Docker tələb olunmur, birbaşa GCP Cloud Build üzərində təmiz build olunur
gcloud builds submit --tag "${IMAGE_NAME}" .

echo "=== 3. Cloud Run-a Deploy ==="
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10

echo "✅ Deploy uğurla tamamlandı!"
