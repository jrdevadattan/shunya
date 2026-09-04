@echo off
REM ============================================================
REM  SHUNYA - launch the packaged app AS ADMINISTRATOR
REM  Use this for a LIVE device WIPE (deletion demo).
REM  A Windows UAC prompt will appear - click YES.
REM  (Not needed for the dry-run or for retrieval.)
REM ============================================================
powershell -NoProfile -Command "Start-Process -FilePath '%~dp0..\apps\desktop\out\SIH Recovery Platform-win32-x64\recovery-platform.exe' -Verb RunAs"
