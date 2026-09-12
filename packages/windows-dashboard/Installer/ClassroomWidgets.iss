; Inno Setup script for Classroom Widgets (per-user install, no admin required).
; Build: iscc /DAppVersion=0.1.0 /DSourceDir=..\dist ClassroomWidgets.iss

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\dist"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist-installer"
#endif

#define AppName "Classroom Widgets"
#define AppExe "ClassroomWidgets.exe"
#define RunValueName "ClassroomWidgets"

[Setup]
AppId={{7C1E2B54-3F0A-4D3B-9C7E-5B2A8E1F6D43}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Tinkertanker
AppPublisherURL=https://github.com/tinkertanker/classroom-widgets
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=ClassroomWidgets-v{#AppVersion}-windows-x64-setup
SetupIconFile=..\Assets\AppIcon.ico
UninstallDisplayIcon={app}\{#AppExe}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "autostart"; Description: "Start {#AppName} automatically when I sign in"; GroupDescription: "Startup:"
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Registry]
; Same HKCU Run value the app's "Launch at login" tray toggle manages.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#RunValueName}"; ValueData: """{app}\{#AppExe}"""; Flags: uninsdeletevalue; Tasks: autostart
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueName: "{#RunValueName}"; Flags: deletevalue uninsdeletevalue; Tasks: not autostart

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "taskkill"; Parameters: "/IM {#AppExe} /F"; Flags: runhidden; RunOnceId: "KillApp"
