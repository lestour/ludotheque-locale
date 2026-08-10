param([int]$Port = 8765)

$Root = [IO.Path]::GetFullPath($PSScriptRoot)
$MimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.wav' = 'audio/wav'
  '.mp3' = 'audio/mpeg'
  '.sf3' = 'application/octet-stream'
  '.wasm' = 'application/wasm'
}

$Listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Port)
$Listener.Start()
try {
  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Reader = New-Object IO.StreamReader($Stream, [Text.Encoding]::ASCII, $false, 1024, $true)
      $Request = $Reader.ReadLine()
      while (($Header = $Reader.ReadLine()) -ne '') { if ($null -eq $Header) { break } }
      if (-not $Request) { continue }
      $Parts = $Request.Split(' ')
      $UrlPath = [Uri]::UnescapeDataString(($Parts[1] -split '\?')[0])
      if ($UrlPath -eq '/') { $UrlPath = '/index.html' }
      $Relative = $UrlPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
      $File = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
      $Allowed = $File.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)
      if ($Allowed -and [IO.File]::Exists($File)) {
        $Body = [IO.File]::ReadAllBytes($File)
        $Extension = [IO.Path]::GetExtension($File).ToLowerInvariant()
        $Mime = if ($MimeTypes.ContainsKey($Extension)) { $MimeTypes[$Extension] } else { 'application/octet-stream' }
        $Status = 'HTTP/1.1 200 OK'
      } else {
        $Body = [Text.Encoding]::UTF8.GetBytes('Fichier introuvable')
        $Mime = 'text/plain; charset=utf-8'
        $Status = 'HTTP/1.1 404 Not Found'
      }
      $Response = "$Status`r`nContent-Type: $Mime`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
      $HeaderBytes = [Text.Encoding]::ASCII.GetBytes($Response)
      $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
      $Stream.Write($Body, 0, $Body.Length)
      $Stream.Flush()
    } finally {
      $Client.Close()
    }
  }
} finally {
  $Listener.Stop()
}
