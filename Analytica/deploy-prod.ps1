# deploy-prod.ps1
# Script para automatizar el despliegue del Frontend de Analytica

$PROJECT_ID = "maikbottrade"
$REGION = "us-central1"
$REPO = "analytica-repo"
$IMAGE_NAME = "frontend"
$VM_NAME = "analytica-frontend-vm"
$ZONE = "us-central1-a"

$FULL_IMAGE_PATH = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/${IMAGE_NAME}:latest"

Write-Host "--- Iniciando Despliegue de Analytica Frontend ---" -ForegroundColor Cyan

# 1. Build y Push a Artifact Registry
Write-Host "[1/2] Construyendo y subiendo imagen a GCP Artifact Registry..." -ForegroundColor Yellow
gcloud builds submit --tag $FULL_IMAGE_PATH ./frontend

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Falló la construcción de la imagen." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2. SSH a la VM para actualizar el contenedor
Write-Host "[2/2] Actualizando contenedor en la VM ($VM_NAME)..." -ForegroundColor Yellow

$SSH_COMMAND = @"
sudo gcloud auth configure-docker $REGION-docker.pkg.dev --quiet && \
sudo docker pull $FULL_IMAGE_PATH && \
sudo docker stop frontend 2>/dev/null || true && \
sudo docker rm frontend 2>/dev/null || true && \
sudo docker run -d --name frontend --restart always -p 80:3000 -e HOST=0.0.0.0 $FULL_IMAGE_PATH
"@

gcloud compute ssh $VM_NAME --zone=$ZONE --command="$SSH_COMMAND"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Falló la actualización en la VM." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "--- Despliegue completado exitosamente! ---" -ForegroundColor Green
Write-Host "URL: http://$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')" -ForegroundColor Cyan
