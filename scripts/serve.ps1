Param(
  [int]$Port = 8000,
  [string]$Root = (Get-Location).Path
)

Add-Type -AssemblyName System.Web
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $Root at $prefix"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $resp = $context.Response
    $path = [System.Web.HttpUtility]::UrlDecode($req.Url.LocalPath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }
    $full = Join-Path -Path $Root -ChildPath $path
    if (Test-Path $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      switch -Regex ($full) {
        '.*\.html$' { $resp.ContentType = 'text/html'; break }
        '.*\.js$'   { $resp.ContentType = 'application/javascript'; break }
        '.*\.css$'  { $resp.ContentType = 'text/css'; break }
        '.*\.svg$'  { $resp.ContentType = 'image/svg+xml'; break }
        default      { $resp.ContentType = 'application/octet-stream' }
      }
      $resp.OutputStream.Write($bytes, 0, $bytes.Length) | Out-Null
    } else {
      $resp.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
      $resp.OutputStream.Write($bytes, 0, $bytes.Length) | Out-Null
    }
    $resp.OutputStream.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}


