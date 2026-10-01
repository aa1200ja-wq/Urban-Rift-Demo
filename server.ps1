$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 4173
$listener = $null
for ($p = 4173; $p -le 4190; $p++) {
  try {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    $listener.Start()
    $port = $p
    break
  } catch {
    if ($listener) { try { $listener.Stop() } catch {} }
    $listener = $null
  }
}
if (-not $listener) {
  Write-Host "Could not start local server." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}
function Mime([string]$path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".webmanifest" { return "application/manifest+json; charset=utf-8" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".webp" { return "image/webp" }
    default { return "application/octet-stream" }
  }
}
$url = "http://127.0.0.1:$port/"
Write-Host "Urban Dungeon Demo" -ForegroundColor Cyan
Write-Host $url
Start-Process "explorer.exe" $url
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $null
    $reader = $null
    try {
      $stream = $client.GetStream()
      $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
      while ($true) { $line=$reader.ReadLine(); if ([string]::IsNullOrEmpty($line)) { break } }
      $parts = $requestLine.Split(' ')
      if ($parts.Length -lt 2) { continue }
      $method = $parts[0]
      $rawPath = $parts[1].Split('?')[0]
      $requestPath = [Uri]::UnescapeDataString($rawPath)
      if ($requestPath -eq '/') { $requestPath = '/index.html' }
      $relative = $requestPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
      $fullPath = [IO.Path]::GetFullPath((Join-Path $root $relative))
      $status = '200 OK'
      $type = 'text/plain; charset=utf-8'
      [byte[]]$body = @()
      if (-not $fullPath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        $status='403 Forbidden'; $body=[Text.Encoding]::UTF8.GetBytes('403 Forbidden')
      } elseif (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $status='404 Not Found'; $body=[Text.Encoding]::UTF8.GetBytes('404 Not Found')
      } else {
        $type = Mime $fullPath
        if ($method -ne 'HEAD') { $body=[IO.File]::ReadAllBytes($fullPath) }
      }
      $header="HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
      $hb=[Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($hb,0,$hb.Length)
      if ($body.Length -gt 0) { $stream.Write($body,0,$body.Length) }
      $stream.Flush()
    } catch {} finally {
      if ($reader) { try {$reader.Dispose()} catch {} }
      if ($stream) { try {$stream.Dispose()} catch {} }
      if ($client) { try {$client.Close()} catch {} }
    }
  }
} finally { if ($listener) {$listener.Stop()} }
