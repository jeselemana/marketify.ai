#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Helmer - Google Cloud Run Environment Variables Setup
# ==============================================================================
# Bu skript lazımi mühit dəyişənlərini birbaşa Cloud Run servisinə tətbiq edir.
# Qiymətləri .env faylınızdan və ya aşağıdakı parametrlərdən götürə bilərsiniz.
# ==============================================================================

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GOOGLE_CLOUD_REGION:-us-central1}"
SERVICE_NAME="helmer"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ GCP Project ID tapılmadı. 'gcloud config set project <PROJECT_ID>' icra edin."
  exit 1
fi

echo "Cloud Run servisinə environment dəyişənləri tətbiq edilir (${SERVICE_NAME})..."

# Əgər .env faylı mövcuddursa, istifadəçi oradakı dəyərlərdən istifadə edə bilər
# Lakin heç vaxt .env faylını konteynerin içinə kopyalamırıq!
gcloud run services update "${SERVICE_NAME}" \
  --region "${REGION}" \
  --update-env-vars "^##^NODE_ENV=production##PORT=8080##GEMINI_USE_VERTEX=true##GOOGLE_CLOUD_LOCATION=us-central1##GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"

echo ""
echo "=== DİQQƏT: Secret və API Key-ləri əlavə etmək üçün: ==="
echo "Aşağıdakı əmri öz açarlarınızla icra edin:"
echo ""
cat << 'EOF'
gcloud run services update helmer \
  --region us-central1 \
  --update-env-vars "^##^GEMINI_API_KEY=YOUR_GEMINI_KEY##OPENAI_API_KEY=YOUR_OPENAI_KEY##GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID##REDIS_URL=YOUR_REDIS_URL##R2_ENDPOINT=YOUR_R2_ENDPOINT##R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY##R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_KEY##R2_BUCKET_NAME=innovagrp##RESEND_API_KEY=YOUR_RESEND_KEY##EMAIL_FROM=Helmer <no-reply@helmerworkspace.com>##APP_URL=https://your-domain.com"
EOF

echo ""
echo "Və ya Google Cloud Console -> Cloud Run -> helmer -> 'Edit & Deploy New Revision' -> 'Variables & Secrets' bölməsindən daxil edin."
