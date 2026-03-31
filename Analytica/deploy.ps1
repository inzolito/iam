# deploy.ps1
# Script completo: git commit + deploy backend + deploy frontend

param(
    [string]$Message = ""
)

$PROJECT_ID    = "maikbottrade"
$REGION        = "us-central1"
$REPO          = "analytica-repo"
$BACKEND_IMAGE = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest"
$FRONTEND_IMAGE= "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/frontend:latest"
$VM_NAME       = "analytica-frontend-vm"
$ZONE          = "us-central1-a"

# ── 1. Git ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/3] GIT" -ForegroundColor Cyan

$gitStatus = git status --porcelain
if ($gitStatus) {
    if ($Message -eq "") {
        $Message = Read-Host "  Mensaje de commit"
    }
    if ($Message -eq "") {
        Write-Host "  ERROR: Se requiere un mensaje de commit." -ForegroundColor Red
        exit 1
    }
    git add -A
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: git commit fallo." -ForegroundColor Red; exit 1 }
    git push
    if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: git push fallo." -ForegroundColor Red; exit 1 }
    Write-Host "  Cambios subidos a git." -ForegroundColor Green
} else {
    Write-Host "  Sin cambios pendientes en git." -ForegroundColor DarkGray
}

# ── 2. Backend ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3] BACKEND - Cloud Run" -ForegroundColor Cyan

Write-Host "  Construyendo imagen..."
gcloud builds submit --tag $BACKEND_IMAGE ./backend --project $PROJECT_ID
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: build del backend fallo." -ForegroundColor Red; exit 1 }

Write-Host "  Desplegando en Cloud Run..."
gcloud run deploy analytica-backend --image $BACKEND_IMAGE --region $REGION --project $PROJECT_ID --quiet
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: deploy del backend fallo." -ForegroundColor Red; exit 1 }

Write-Host "  Backend desplegado." -ForegroundColor Green

# ── 3. Frontend ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/3] FRONTEND - VM" -ForegroundColor Cyan

Write-Host "  Construyendo imagen..."
gcloud builds submit --tag $FRONTEND_IMAGE ./frontend --project $PROJECT_ID
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: build del frontend fallo." -ForegroundColor Red; exit 1 }

Write-Host "  Actualizando contenedor en la VM..."
$CMD  = "sudo gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet"
$CMD += "; sudo docker pull ${FRONTEND_IMAGE}"
$CMD += "; sudo docker stop frontend 2>/dev/null; sudo docker rm frontend 2>/dev/null"
$CMD += "; sudo docker run -d --name frontend --restart always -p 3000:3000 -e HOST=0.0.0.0 ${FRONTEND_IMAGE}"

gcloud compute ssh $VM_NAME --zone=$ZONE --command=$CMD
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: actualizacion del frontend fallo." -ForegroundColor Red; exit 1 }

Write-Host "  Frontend desplegado." -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────────────────────
$IP = gcloud compute instances describe $VM_NAME --zone=$ZONE '--format=get(networkInterfaces[0].accessConfigs[0].natIP)'
Write-Host ""
Write-Host "--- Deploy completado ---" -ForegroundColor Green
Write-Host "URL: http://$IP" -ForegroundColor Cyan
