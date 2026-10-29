' Attendly Silent Launcher - Launches Attendly with 0 CMD window
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if native Attendly.exe is available
exeInstalled = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Attendly\Attendly.exe"
exeUnpacked = currentDir & "\release\win-unpacked\Attendly.exe"

targetExe = ""
If fso.FileExists(exeUnpacked) And fso.FileExists(exeInstalled) Then
    If fso.GetFile(exeUnpacked).DateLastModified >= fso.GetFile(exeInstalled).DateLastModified Then
        targetExe = exeUnpacked
    Else
        targetExe = exeInstalled
    End If
ElseIf fso.FileExists(exeUnpacked) Then
    targetExe = exeUnpacked
ElseIf fso.FileExists(exeInstalled) Then
    targetExe = exeInstalled
End If

If targetExe <> "" Then
    WshShell.Run Chr(34) & targetExe & Chr(34), 1, False
Else
    ' Fallback to Start-Container.bat with WindowStyle 0 (Completely Hidden - No CMD)
    WshShell.CurrentDirectory = currentDir
    WshShell.Run "cmd.exe /c " & Chr(34) & currentDir & "\Start-Container.bat" & Chr(34), 0, False
End If
