
$dest = "_deploy_test"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dest | Out-Null

# 0. Build Packages
Write-Host "Building packages..."
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building self-contained embed bundle..."
npm run build:bundle -w packages/embed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 1. Landing Page
Copy-Item "apps/demo/landing.html" "$dest/index.html"
# Screenshot not critical for functionality check but needed for landing page
if (Test-Path "screenshot.png") {
    Copy-Item "screenshot.png" "$dest/"
}

# 2. React Demo
New-Item -ItemType Directory -Force -Path "$dest/demo" | Out-Null
Copy-Item "apps/demo/dist/*" "$dest/demo/" -Recurse

# 3. Static Demo
Copy-Item "apps/demo/static-test.html" "$dest/app.html"

# 4. Dependencies
New-Item -ItemType Directory -Force -Path "$dest/packages/embed/dist" | Out-Null
Copy-Item "packages/embed/dist/*" "$dest/packages/embed/dist/"

# Hack: Handle absolute /assets path from Vite chunks if base isn't respected
if (Test-Path "packages/embed/dist/assets") {
    Copy-Item "packages/embed/dist/assets" "$dest/assets" -Recurse -Force
}

# 5. Quick Review
Copy-Item "apps/demo/quick-review.html" "$dest/quick-review.html"
if (Test-Path "apps/demo/public") {
    Copy-Item "apps/demo/public/*" "$dest/" -Recurse -Force
}

# 6. Copy FFmpeg Core from node_modules (Standard NPM approach)
if (Test-Path "node_modules/@ffmpeg/core/dist/esm") {
    Copy-Item "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js" "$dest/"
    Copy-Item "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm" "$dest/"
}

# Patching
$files = @("$dest/app.html", "$dest/quick-review.html")
foreach ($file in $files) {
    (Get-Content $file) -replace '\.\./\.\./packages/embed/dist/', './packages/embed/dist/' | Set-Content $file
}

Write-Host "Deployment simulation complete in $dest"
