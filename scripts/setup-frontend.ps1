$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " CircuitCube Frontend Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Run this script from the CircuitCube root folder:
# circuitcube/
#   models/
#   setup-frontend.ps1

# Check Node/npm
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is not installed or not available in PATH."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is not installed or not available in PATH."
}

Write-Host "Node: $(node --version)"
Write-Host "npm:  $(npm --version)"
Write-Host ""

# Create Vite React + TypeScript app
if (-not (Test-Path ".\frontend")) {
    Write-Host "Creating React + TypeScript frontend..." -ForegroundColor Yellow
    npm create vite@latest frontend -- --template react-ts
}
else {
    Write-Host "frontend/ already exists. Skipping Vite project creation." -ForegroundColor Yellow
}

Set-Location ".\frontend"

Write-Host ""
Write-Host "Installing base dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "Installing CircuitCube 3D dependencies..." -ForegroundColor Yellow
npm install three @react-three/fiber @react-three/drei

# TypeScript typings for Three.js.
npm install -D @types/three

Write-Host ""
Write-Host "Creating initial CircuitCube folders..." -ForegroundColor Yellow

$folders = @(
    ".\public\models",
    ".\src\components\3d",
    ".\src\scene",
    ".\src\types",
    ".\src\lib"
)

foreach ($folder in $folders) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

# Copy exported GLB files from root models/ into frontend/public/models/
$rootModels = "..\models"

if (Test-Path $rootModels) {
    $glbFiles = Get-ChildItem -Path $rootModels -Filter "*.glb" -File -ErrorAction SilentlyContinue

    if ($glbFiles) {
        Write-Host ""
        Write-Host "Copying existing .glb models into frontend/public/models/..." -ForegroundColor Yellow

        foreach ($file in $glbFiles) {
            Copy-Item $file.FullName ".\public\models\$($file.Name)" -Force
            Write-Host "  copied: $($file.Name)"
        }
    }
    else {
        Write-Host ""
        Write-Host "No .glb files found in ../models yet. That's okay." -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " CircuitCube frontend is ready." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next commands:"
Write-Host "  cd frontend"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Installed:"
Write-Host "  React + TypeScript + Vite"
Write-Host "  three"
Write-Host "  @react-three/fiber"
Write-Host "  @react-three/drei"
Write-Host "  @types/three"
