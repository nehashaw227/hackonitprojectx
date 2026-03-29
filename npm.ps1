$CurrentDir = (Get-Item .).FullName

# Forward all arguments passed to this script into the Docker container
$argsList = $args -join " "

if ([string]::IsNullOrWhiteSpace($argsList)) {
    Write-Host "Please provide an npm command, for example: .\npm.ps1 install"
    exit 1
}

Write-Host "Running: npm $argsList (via Docker Container)" -ForegroundColor Cyan
docker run -it --rm `
    -v "$($CurrentDir):/app" `
    -w /app `
    -p 3000:3000 `
    -p 5173:5173 `
    node:20-alpine `
    npm $args
