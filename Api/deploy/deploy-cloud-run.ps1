param(
    [Parameter(Mandatory = $true)] [string] $ProjectId,
    [string] $Region = 'southamerica-east1',
    [string] $Service = 'docvia-api',
    [string] $Repository = 'docvia',
    [string] $EnvFile = "$PSScriptRoot\cloud-run.env.yaml"
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw 'Google Cloud CLI (gcloud) não encontrado.'
}
if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw "Arquivo de ambiente não encontrado: $EnvFile. Copie cloud-run.env.yaml.example, preencha e remova todos os SUBSTITUIR."
}
if (Select-String -LiteralPath $EnvFile -Pattern 'SUBSTITUIR' -Quiet) {
    throw 'O arquivo de ambiente ainda contém valores SUBSTITUIR.'
}

$requiredSecrets = @(
    'docvia-database-url',
    'docvia-jwt-secret',
    'docvia-gemini-api-key',
    'docvia-resend-api-key',
    'docvia-r2-access-key-id',
    'docvia-r2-secret-access-key',
    'docvia-job-runner-secret'
)
gcloud config set project $ProjectId | Out-Null
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com cloudtasks.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com iam.googleapis.com | Out-Null
foreach ($secret in $requiredSecrets) {
    gcloud secrets describe $secret --project $ProjectId --quiet | Out-Null
}

$runtimeServiceAccountName = 'docvia-api-runtime'
$runtimeServiceAccount = "$runtimeServiceAccountName@$ProjectId.iam.gserviceaccount.com"
$serviceAccountExists = $true
try { gcloud iam service-accounts describe $runtimeServiceAccount --quiet | Out-Null } catch { $serviceAccountExists = $false }
if (-not $serviceAccountExists) {
    gcloud iam service-accounts create $runtimeServiceAccountName --display-name 'DocVia API runtime' | Out-Null
}
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$runtimeServiceAccount" --role roles/secretmanager.secretAccessor --condition None --quiet | Out-Null
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$runtimeServiceAccount" --role roles/cloudtasks.enqueuer --condition None --quiet | Out-Null

$repositoryExists = $true
try { gcloud artifacts repositories describe $Repository --location $Region --quiet | Out-Null } catch { $repositoryExists = $false }
if (-not $repositoryExists) {
    gcloud artifacts repositories create $Repository --repository-format docker --location $Region --description 'Imagens de produção do DocVia' | Out-Null
}

$queueExists = $true
try { gcloud tasks queues describe docvia-document-processing --location $Region --quiet | Out-Null } catch { $queueExists = $false }
if (-not $queueExists) {
    gcloud tasks queues create docvia-document-processing --location $Region --max-attempts 10 --max-concurrent-dispatches 2 --max-dispatches-per-second 2 --min-backoff 2s --max-backoff 60s | Out-Null
}

$image = "$Region-docker.pkg.dev/$ProjectId/$Repository/$Service`:$(Get-Date -Format 'yyyyMMddHHmmss')"
$apiRoot = Split-Path -Parent $PSScriptRoot
gcloud builds submit $apiRoot --tag $image --quiet

$secretMappings = @(
    'DATABASE_URL=docvia-database-url:latest',
    'JWT_SECRET=docvia-jwt-secret:latest',
    'GEMINI_API_KEY=docvia-gemini-api-key:latest',
    'RESEND_API_KEY=docvia-resend-api-key:latest',
    'R2_ACCESS_KEY_ID=docvia-r2-access-key-id:latest',
    'R2_SECRET_ACCESS_KEY=docvia-r2-secret-access-key:latest',
    'JOB_RUNNER_SECRET=docvia-job-runner-secret:latest'
) -join ','

gcloud run deploy $Service --image $image --region $Region --service-account $runtimeServiceAccount --allow-unauthenticated --port 8080 --memory 1Gi --cpu 1 --concurrency 4 --timeout 300 --max-instances 3 --min-instances 0 --env-vars-file $EnvFile --set-secrets $secretMappings --quiet

$serviceUrl = gcloud run services describe $Service --region $Region --format 'value(status.url)'
if (-not $serviceUrl) { throw 'Não foi possível obter o endereço do serviço.' }

gcloud run services update $Service --region $Region --update-env-vars "API_URL=$serviceUrl,CLOUD_RUN_SERVICE_URL=$serviceUrl" --quiet | Out-Null

$maintenanceExists = $true
try { gcloud scheduler jobs describe docvia-jobs-maintenance --location $Region --quiet | Out-Null } catch { $maintenanceExists = $false }
if (-not $maintenanceExists) {
    Write-Warning 'Crie o agendamento docvia-jobs-maintenance no Console do Google Cloud usando POST /internal/jobs/maintenance e o mesmo JOB_RUNNER_SECRET. O segredo não é exibido por este script.'
}

Write-Output "API publicada em $serviceUrl"
