$wsh = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "QR Attendance System.lnk"

$appDir = "C:\Users\Alex\Desktop\QrAttendance"
$targetBat = Join-Path $appDir "start-desktop.bat"
$iconPath = Join-Path $appDir "src\app\favicon.ico"

$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetBat
$shortcut.WorkingDirectory = $appDir
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "Launch QR Attendance System (Desktop App, Server & Tunnel)"
$shortcut.Save()

Write-Host "Created shortcut: $shortcutPath"
