#Requires -Version 5.1
<#
  wsa-window-guard.ps1 - keep a Windows Subsystem for Android app window inside the primary work area.

  Why this exists (same notes in scripts/android-dev.sh):
  WSA stores the last window rect of every Android package on its own side (settings.dat, held open
  exclusively by WsaService, so it cannot be edited from outside). While the window lives, WSA
  re-applies that rect roughly every 2-6 seconds. When the stored rect comes from an older
  multi-monitor layout (x=2563 on a 1920-wide single screen) the whole window sits off-screen:
  adb looks perfectly healthy while nothing is visible.
  Verified dead ends: plain SetWindowPos, WM_ENTERSIZEMOVE/WM_EXITSIZEMOVE around the move,
  simulated user drag on the caption, WM_CLOSE while held at the new spot. Each one is reverted
  within seconds and WSA never updates its record. The only user-space cure is to keep correcting
  the position, which is what this script does.

  This file is intentionally ASCII-only: PowerShell 5.1 reads non-BOM files as ANSI and would
  garble non-ASCII literals. Keep it ASCII if you edit it.

  Usage:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/wsa-window-guard.ps1 -Class com.househub.mobile
    -IntervalMs 300   how often to re-check (smaller = shorter off-screen blink)
    -Margin 12        gap to the work-area edge
    -Width/-Height    optional target size applied once (0 = keep whatever WSA chose)
    -Seconds 0        run forever; >0 run for that many seconds
    -Once             correct once and exit
    -Quiet            no banner
#>
param(
  [string]$Class = "com.househub.mobile",
  [int]$Width = 0,
  [int]$Height = 0,
  [int]$Margin = 12,
  [int]$IntervalMs = 300,
  [int]$Seconds = 0,
  [string]$BeatFile = "",
  [switch]$Once,
  [switch]$Quiet
)

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class WsaGuard {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr c);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public class Hit { public IntPtr Hwnd; public int L, T, W, Ht; public bool Iconic; }
  public static List<Hit> All(string cls) {
    var list = new List<Hit>();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      var cs = new StringBuilder(256); GetClassNameW(h, cs, 256);
      if (cs.ToString() != cls) return true;
      RECT d;
      if (DwmGetWindowAttribute(h, 9, out d, Marshal.SizeOf(typeof(RECT))) != 0) {
        if (!GetWindowRect(h, out d)) return true;
      }
      list.Add(new Hit { Hwnd = h, L = d.L, T = d.T, W = d.R - d.L, Ht = d.B - d.T, Iconic = IsIconic(h) });
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
"@

[void][WsaGuard]::SetProcessDpiAwarenessContext([IntPtr](-4))
Add-Type -AssemblyName System.Windows.Forms
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$maxW = [Math]::Max(240, $wa.Width - 2 * $Margin)
$maxH = [Math]::Max(240, $wa.Height - 2 * $Margin)
$wantW = if ($Width -gt 0) { [Math]::Min($Width, $maxW) } else { 0 }
$wantH = if ($Height -gt 0) { [Math]::Min($Height, $maxH) } else { 0 }
$sized = $false

if (-not $Quiet) {
  Write-Output ("[wsa-guard] primary workarea " + $wa.Width + "x" + $wa.Height + " at " + $wa.X + "," + $wa.Y + "; screens " + @([System.Windows.Forms.Screen]::AllScreens).Count + "; watching class '" + $Class + "' every " + $IntervalMs + "ms")
}

# heartbeat: android-dev.sh touches this file every watch-loop tick. If it goes stale the script is
# gone (Ctrl-C, crash, hard kill) and this process must not linger as an orphan holding a window.
$fixed = 0
$beatDead = $false
$lastLog = [DateTime]::MinValue
$deadline = if ($Once) { [DateTime]::Now } elseif ($Seconds -gt 0) { (Get-Date).AddSeconds($Seconds) } else { [DateTime]::MaxValue }

do {
  $hits = @([WsaGuard]::All($Class))
  if ($hits.Count -gt 0) {
    $w = $hits | Sort-Object { $_.W * $_.Ht } -Descending | Select-Object -First 1
    # every screen counts: a window fully on any monitor is fine, so a real second display is not fought.
    $sc = @([System.Windows.Forms.Screen]::AllScreens)
    $inside = $false
    foreach ($s in $sc) {
      $r2 = $s.WorkingArea
      if (($w.L -ge $r2.X) -and ($w.T -ge $r2.Y) -and
          (($w.L + $w.W) -le ($r2.X + $r2.Width)) -and (($w.T + $w.Ht) -le ($r2.Y + $r2.Height))) { $inside = $true; break }
    }
    $off = -not $inside
    $tooBig = ($w.W -gt $maxW) -or ($w.Ht -gt $maxH)
    $needSize = (-not $sized) -and (($wantW -gt 0) -or ($wantH -gt 0))
    if ($off -or $tooBig -or $needSize -or $w.Iconic) {
      # park the window on the monitor it most overlaps (primary when it overlaps nothing)
      $target = $wa
      $best = -1
      foreach ($s in $sc) {
        $r2 = $s.WorkingArea
        $ix = [Math]::Max(0, [Math]::Min($w.L + $w.W, $r2.X + $r2.Width) - [Math]::Max($w.L, $r2.X))
        $iy = [Math]::Max(0, [Math]::Min($w.T + $w.Ht, $r2.Y + $r2.Height) - [Math]::Max($w.T, $r2.Y))
        if (($ix * $iy) -gt $best) { $best = $ix * $iy; $target = $r2 }
      }
      $tw = [Math]::Max(240, $target.Width - 2 * $Margin)
      $th = [Math]::Max(240, $target.Height - 2 * $Margin)
      $nw = if ($wantW -gt 0 -and (-not $sized)) { [Math]::Min($wantW, $tw) } else { [Math]::Min($w.W, $tw) }
      $nh = if ($wantH -gt 0 -and (-not $sized)) { [Math]::Min($wantH, $th) } else { [Math]::Min($w.Ht, $th) }
      $nx = $target.X + [int](($target.Width - $nw) / 2)
      $ny = $target.Y + [int](($target.Height - $nh) / 2)
      if ($w.Iconic) { [void][WsaGuard]::ShowWindow($w.Hwnd, 9) }
      [void][WsaGuard]::SetWindowPos($w.Hwnd, [IntPtr]::Zero, $nx, $ny, $nw, $nh, 0x0004)
      $sized = $true
      $fixed++
      if (((Get-Date) - $lastLog).TotalSeconds -ge 10) {
        $lastLog = Get-Date
        if (-not $Quiet) { Write-Output ("[wsa-guard] fix #" + $fixed + ": was " + $w.L + "," + $w.T + " " + $w.W + "x" + $w.Ht + " -> " + $nx + "," + $ny + " " + $nw + "x" + $nh) }
      }
    }
  }
  if ($BeatFile -ne "") {
    $fresh = $false
    if (Test-Path -LiteralPath $BeatFile) {
      $fresh = (((Get-Date) - (Get-Item -LiteralPath $BeatFile).LastWriteTime).TotalSeconds -lt 25)
    }
    if (-not $fresh) {
      if (-not $Quiet) { Write-Output "[wsa-guard] heartbeat stale or missing, exiting" }
      $beatDead = $true
      break
    }
  }
  if ($Once) { break }
  Start-Sleep -Milliseconds $IntervalMs
} while ((Get-Date) -lt $deadline)

if (-not $Quiet) { Write-Output ("[wsa-guard] exit, total fixes " + $fixed) }
