' Lance Multiposter sans fenetre ; le journal va dans data\multiposter.log.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = appDir
If Not fso.FolderExists(appDir & "\data") Then fso.CreateFolder(appDir & "\data")
sh.Run "cmd /c node --disable-warning=ExperimentalWarning src\server.ts >> data\multiposter.log 2>&1", 0, False
