
$dest = "_deploy_test"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dest | Out-Null

# 1. Landing Page
Copy-Item "apps/demo/landing.html" "$dest/index.html"
# Screenshot not critical for functionality check

# 2. React Demo
New-Item -ItemType Directory -Force -Path "$dest/demo" | Out-Null
Copy-Item "apps/demo/dist/*" "$dest/demo/" -Recurse

# 3. Static Demo
Copy-Item "apps/demo/static-test.html" "$dest/app.html"

# 4. Dependencies
New-Item -ItemType Directory -Force -Path "$dest/packages/embed/dist" | Out-Null
Copy-Item "packages/embed/dist/*" "$dest/packages/embed/dist/"

# 5. Quick Review
Copy-Item "apps/demo/quick-review.html" "$dest/quick-review.html"

# Patching
$files = @("$dest/app.html", "$dest/quick-review.html")
foreach ($file in $files) {
    (Get-Content $file) -replace '\.\./\.\./packages/embed/dist/', './packages/embed/dist/' | Set-Content $file
}

Write-Host "Deployment simulation complete in $dest"
