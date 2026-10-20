@echo off
echo Unblocking Node.js and Port 3000 in Windows Firewall...
netsh advfirewall firewall set rule name="Node.js JavaScript Runtime" new action=allow
netsh advfirewall firewall delete rule name="QR Attendance Port 3000" >nul 2>&1
netsh advfirewall firewall add rule name="QR Attendance Port 3000" dir=in action=allow protocol=TCP localport=3000
echo Done!
