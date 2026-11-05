<#
  Reconstruye Postit Desk, prueba el backend empaquetado, instala y abre la app.
  Todo queda en la carpeta .\diagnostico para poder revisarlo despues.

  Uso (desde la raiz del proyecto):
    powershell -ExecutionPolicy Bypass -File scripts\reconstruir-y-verificar.ps1
#>
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
$diag = Join-Path $root 'diagnostico'
Set-Location $root
New-Item -ItemType Directory -Force $diag | Out-Null
Remove-Item "$diag\*" -Force -ErrorAction SilentlyContinue
$summary = Join-Path $diag 'resumen.txt'
function Note($text) { $text | Tee-Object -FilePath $summary -Append }

Note "== Postit Desk: $(Get-Date -Format s)"
Note "Node $(node -v), npm $(npm -v)"
if ([version]((node -v).TrimStart('v')) -lt [version]'22.12.0') { Note 'AVISO: Electron 44 pide Node 22.12 o superior. Conviene actualizar Node a la version 22 LTS.' }

# 1. Cerrar la app si esta abierta (bloquea archivos de release).
Get-Process -Name 'Postit Desk' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# 2. Limpiar salidas anteriores.
Remove-Item -Recurse -Force apps\backend\dist, apps\desktop\out, apps\desktop\release, apps\desktop\.backend-staging -ErrorAction SilentlyContinue

# 3. Instalar dependencias segun package.json (corrige versiones viejas que hayan quedado).
Note '== Instalando dependencias...'
cmd /c "npm install --prefix apps\backend --no-audit --no-fund 2>&1" | Out-File -FilePath "$diag\install.log" -Encoding utf8
cmd /c "npm install --prefix apps\desktop --no-audit --no-fund 2>&1" | Out-File -FilePath "$diag\install.log" -Encoding utf8 -Append
Note "electron-builder instalado: $(node -p "require('./apps/desktop/node_modules/electron-builder/package.json').version")"

# 4. Construir.
Note '== Construyendo (npm run dist)...'
cmd /c "npm run dist 2>&1" | Out-File -FilePath "$diag\build.log" -Encoding utf8
Note "Codigo de salida del build: $LASTEXITCODE"
$backend = Join-Path $root 'apps\desktop\release\win-unpacked\resources\backend'
if (-not (Test-Path "$backend\dist\main.js")) { Note 'ERROR: no se genero el backend empaquetado. Ver build.log'; exit 1 }
if (-not (Test-Path "$backend\node_modules\reflect-metadata")) { Note 'ERROR: el backend empaquetado no trae sus dependencias (node_modules). Ver build.log'; exit 1 }
Note 'Backend empaquetado con sus dependencias: OK'

# 5. Probar el backend empaquetado con dos motores: Node del sistema y Node de Electron.
function Test-Backend($label, $exe, $extraEnv, $dbPath = $null) {
  $port = Get-Random -Minimum 41000 -Maximum 49000
  if (-not $dbPath) { $dbPath = Join-Path $diag "prueba-$label.sqlite" }
  $env:PORT = "$port"; $env:API_TOKEN = 'prueba'; $env:DB_PATH = $dbPath
  foreach ($k in $extraEnv.Keys) { Set-Item "env:$k" $extraEnv[$k] }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $proc = Start-Process -FilePath $exe -ArgumentList 'dist\main.js' -WorkingDirectory $backend -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput "$diag\backend-$label.out.log" -RedirectStandardError "$diag\backend-$label.err.log"
  $ok = $false
  while ($sw.Elapsed.TotalSeconds -lt 60 -and -not $proc.HasExited) {
    try { Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec 2 | Out-Null; $ok = $true; break } catch { Start-Sleep -Milliseconds 500 }
  }
  $state = if ($ok) { "RESPONDIO en $([int]$sw.Elapsed.TotalSeconds) s" } elseif ($proc.HasExited) { "SE CERRO con codigo $($proc.ExitCode)" } else { 'NO RESPONDIO en 60 s' }
  Note "Backend con $label : $state"
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
  foreach ($k in @('PORT','API_TOKEN','DB_PATH') + @($extraEnv.Keys)) { Remove-Item "env:$k" -ErrorAction SilentlyContinue }
}
Test-Backend 'node-sistema' 'node' @{}
$electronExe = Join-Path $root 'apps\desktop\release\win-unpacked\Postit Desk.exe'
Test-Backend 'node-electron' $electronExe @{ ELECTRON_RUN_AS_NODE = '1' }
# Confirmacion de la causa: la misma prueba heredando la variable de crashpad de Chromium.
Test-Backend 'node-electron-con-crashpad' $electronExe @{ ELECTRON_RUN_AS_NODE = '1'; CHROME_CRASHPAD_PIPE_NAME = '\\.\pipe\crashpad_prueba_inexistente' }

# Prueba con una COPIA de la base de datos real de la app (el original no se toca).
$realDb = Join-Path $env:APPDATA 'Postit Desk\postit-desk.sqlite'
if (Test-Path $realDb) {
  $dbCopy = Join-Path $diag 'copia-base-real.sqlite'
  Copy-Item $realDb $dbCopy -Force
  Note "Base de datos real: $([math]::Round((Get-Item $realDb).Length / 1KB, 1)) KB, modificada $((Get-Item $realDb).LastWriteTime)"
  Test-Backend 'base-real' $electronExe @{ ELECTRON_RUN_AS_NODE = '1' } $dbCopy
} else {
  Note 'No existe base de datos real todavia.'
}

# 6. Instalar en silencio y abrir la app.
$installer = Get-ChildItem 'apps\desktop\release\*.exe' | Select-Object -First 1
Note "== Instalando $($installer.Name)..."
Get-Process -Name 'Postit Desk' -ErrorAction SilentlyContinue | Stop-Process -Force
$setup = Start-Process -FilePath $installer.FullName -ArgumentList '/S' -PassThru
if (-not $setup.WaitForExit(180000)) { Note 'ERROR: el instalador no termino en 3 minutos.'; Stop-Process -Id $setup.Id -Force; exit 1 }
Note "Instalador termino con codigo $($setup.ExitCode)"
$app = Join-Path $env:LOCALAPPDATA 'Programs\postit-desk\Postit Desk.exe'
if (-not (Test-Path $app)) { Note "ERROR: no se encontro la app instalada en $app"; exit 1 }
Note '== Abriendo la app instalada y esperando 50 s...'
Start-Process -FilePath $app
Start-Sleep -Seconds 50
Copy-Item (Join-Path $env:APPDATA 'Postit Desk\logs\backend.log') "$diag\backend-app.log" -ErrorAction SilentlyContinue
Copy-Item (Join-Path $env:APPDATA 'Postit Desk\logs\window.log') "$diag\window.log" -ErrorAction SilentlyContinue
$running = [bool](Get-Process -Name 'Postit Desk' -ErrorAction SilentlyContinue)
Note "App en ejecucion despues de 50 s: $running"
$started = Select-String -Path "$diag\backend-app.log" -Pattern 'Backend listo' -Quiet -ErrorAction SilentlyContinue
Note ("Backend dentro de la app: " + $(if ($started) { 'ARRANCO' } else { 'NO ARRANCO (ver backend-app.log)' }))
Note '== Listo. Los archivos quedaron en la carpeta diagnostico.'
