$wsh = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "QR Attendance System.lnk"

$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "C:\Users\Alex\Desktop\Qrscaner\start.bat"
$shortcut.WorkingDirectory = "C:\Users\Alex\Desktop\Qrscaner"
$shortcut.IconLocation = "C:\Users\Alex\Desktop\Qrscaner\src\app\favicon.ico"
$shortcut.Description = "Start QR Attendance System (Server + Tunnel)"
$shortcut.Save()

Write-Host "Created shortcut: $shortcutPath"
