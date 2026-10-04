$targetZip = Join-Path (Get-Location) "patch-update.zip"
if (Test-Path $targetZip) {
    Remove-Item -Force $targetZip
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$tempDir = Join-Path $env:TEMP ("patch_" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempDir | Out-Null

# 1. API src
$apiSrcDest = Join-Path $tempDir "apps\api\src"
New-Item -ItemType Directory -Path (Split-Path $apiSrcDest) -Force | Out-Null
Copy-Item -Recurse -Path "apps\api\src" -Destination $apiSrcDest

# 2. Web dist
$webDistDest = Join-Path $tempDir "apps\web\dist"
New-Item -ItemType Directory -Path (Split-Path $webDistDest) -Force | Out-Null
Copy-Item -Recurse -Path "apps\web\dist" -Destination $webDistDest

# 3. DB & Scripts
Copy-Item -Recurse -Path "db" -Destination (Join-Path $tempDir "db")
Copy-Item -Recurse -Path "scripts" -Destination (Join-Path $tempDir "scripts")

# 4. Root configs
Copy-Item -Path ".htaccess" -Destination $tempDir
Copy-Item -Path "package.json" -Destination $tempDir

[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $targetZip)
Remove-Item -Recurse -Force $tempDir

Write-Host "Success! patch-update.zip created with size: $((Get-Item $targetZip).Length) bytes"
