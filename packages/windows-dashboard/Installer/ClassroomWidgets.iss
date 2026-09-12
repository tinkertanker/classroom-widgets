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
#define RunKey "Software\Microsoft\Windows\CurrentVersion\Run"
#define AppGuid "{7C1E2B54-3F0A-4D3B-9C7E-5B2A8E1F6D43}"
#define AutostartDescription "Start " + AppName + " automatically when I sign in"

[Setup]
AppId={{#AppGuid}
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
Name: "autostart"; Description: "{#AutostartDescription}"; GroupDescription: "Startup:"
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Registry]
; Same HKCU Run value the app's "Launch at login" tray toggle manages.
Root: HKCU; Subkey: "{#RunKey}"; ValueType: string; ValueName: "{#RunValueName}"; ValueData: """{app}\{#AppExe}"""; Flags: uninsdeletevalue; Check: AutostartWanted
Root: HKCU; Subkey: "{#RunKey}"; ValueName: "{#RunValueName}"; Flags: deletevalue uninsdeletevalue; Check: not AutostartWanted

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "taskkill"; Parameters: "/IM {#AppExe} /F"; Flags: runhidden; RunOnceId: "KillApp"

[Code]
// On upgrades the current Run value (which the app's tray toggle may have
// changed) wins over whatever task selection Setup remembered last time.
function IsUpgrade: Boolean;
begin
  Result := RegValueExists(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#AppGuid}_is1', 'UninstallString');
end;

function AutostartCurrentlyEnabled: Boolean;
begin
  Result := RegValueExists(HKCU, '{#RunKey}', '{#RunValueName}');
end;

function AutostartWanted: Boolean;
begin
  if WizardSilent and IsUpgrade then
    Result := AutostartCurrentlyEnabled
  else
    Result := WizardIsTaskSelected('autostart');
end;

procedure CurPageChanged(CurPageID: Integer);
var
  I: Integer;
begin
  if (CurPageID = wpSelectTasks) and IsUpgrade then
    for I := 0 to WizardForm.TasksList.Items.Count - 1 do
      if WizardForm.TasksList.ItemCaption[I] = '{#AutostartDescription}' then
        WizardForm.TasksList.Checked[I] := AutostartCurrentlyEnabled;
end;
