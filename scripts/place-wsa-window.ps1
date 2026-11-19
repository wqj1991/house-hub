#Requires -Version 5.1
<#
  把 WSA 应用窗口（WsaClient 宿主窗口）挪回当前主屏并收敛到合适尺寸。

  背景：WSA 会按秒级记忆每个包上次的窗口位置。曾经接过第二个显示器 / 改过分辨率后，
  窗口可能被恢复到 x=2563 这种主屏之外的坐标（主屏 1920x1200），宿主窗口就"看不见"了；
  同时在 1320x2848@455dpi 这类手机 override 下，窗口只有 ~220dp 宽，WebView 视口被压扁。

  用法：
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/place-wsa-window.ps1 -Title house-hub
    powershell ... -Title house-hub -Height 980        # 指定高度（物理像素），宽度按现有比例
    powershell ... -Title house-hub -Width 500 -Height 1000 -Force
#>
param(
  [string]$Title = "",
  [string]$ProcessName = "WsaClient",
  [int]$Width = 0,
  [int]$Height = 0,
  [int]$Margin = 24,
  [int]$TimeoutMs = 15000,
  [switch]$Force,
  [switch]$Quiet
)

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class WsaWin {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }

  public class Info {
    public IntPtr Hwnd;
    public uint Pid;
    public string Title = "";
    public string Cls = "";
    public int L, T, W, H;
  }

  public static List<Info> All() {
    var list = new List<Info>();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512);
      GetWindowTextW(h, sb, 512);
      var t = sb.ToString();
      if (t.Length == 0) return true;
      RECT r; if (!GetWindowRect(h, out r)) return true;
      RECT dr;
      // 有 DWM 边框时用 DWMWA_EXTENDED_FRAME_BOUNDS 拿真实可见矩形
      if (DwmGetWindowAttribute(h, 9, out dr, Marshal.SizeOf(typeof(RECT))) != 0) dr = r;
      uint pid; GetWindowThreadProcessId(h, out pid);
      var cs = new StringBuilder(256);
      GetClassNameW(h, cs, 256);
      list.Add(new Info { Hwnd = h, Pid = pid, Title = t, Cls = cs.ToString(), L = dr.L, T = dr.T, W = dr.R - dr.L, H = dr.B - dr.T });
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
"@

[void][WsaWin]::SetProcessDpiAwarenessContext([IntPtr](-4))  # PER_MONITOR_AWARE_V2

Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$work = $screen.WorkingArea
if (-not $Quiet) { Write-Output ("[win] 主屏 workarea=" + $work.Width + "x" + $work.Height + " @ " + $work.X + "," + $work.Y) }

$deadline = (Get-Date).AddMilliseconds($TimeoutMs)
$target = $null
while ((Get-Date) -lt $deadline) {
  $pids = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $wins = @([WsaWin]::All() | Where-Object { $pids -contains $_.Pid })
  if ($Title -ne "") {
    $exact = @($wins | Where-Object { $_.Title -eq $Title })
    if ($exact.Count -gt 0) { $target = $exact[0] }
    elseif (@($wins | Where-Object { $_.Title -like "*$Title*" }).Count -gt 0) {
      $target = @($wins | Where-Object { $_.Title -like "*$Title*" })[0]
    }
  } elseif ($wins.Count -gt 0) {
    $target = $wins | Sort-Object { $_.W * $_.H } -Descending | Select-Object -First 1
  }
  if ($target) { break }
  Start-Sleep -Milliseconds 300
}

if (-not $target) {
  Write-Output ("[win] 没找到 " + $ProcessName + " 的窗口（title 过滤: '" + $Title + "'）")
  exit 2
}

$cur = $target
if (-not $Quiet) { Write-Output ("[win] 目标窗口 '" + $cur.Title + "' pid=" + $cur.Pid + " 当前=" + $cur.L + "," + $cur.T + " " + $cur.W + "x" + $cur.H) }

$inside = ($cur.L -ge $work.X) -and ($cur.T -ge $work.Y) -and
          (($cur.L + $cur.W) -le ($work.X + $work.Width)) -and
          (($cur.T + $cur.H) -le ($work.Y + $work.Height))

$aspect = if ($cur.H -gt 0) { $cur.W / [double]$cur.H } else { 0.4636 }

$tw = $Width
$th = $Height
if ($tw -le 0 -and $th -le 0) {
  # 默认：改成手机比例的预览窗（高度占屏高 ~84%），不再沿用上一次被压扁的尺寸
  $th = [int]([Math]::Round(($work.Height - 2 * $Margin) * 0.92))
  $tw = [int]([Math]::Round($th * $aspect))
} elseif ($tw -le 0) {
  $tw = [int]([Math]::Round($th * $aspect))
} elseif ($th -le 0) {
  $th = [int]([Math]::Round($tw / $aspect))
}

# 收敛到 workarea 内（保持比例）
$maxW = $work.Width - 2 * $Margin
$maxH = $work.Height - 2 * $Margin
if ($tw -gt $maxW -or $th -gt $maxH) {
  $scale = [Math]::Min($maxW / [double]$tw, $maxH / [double]$th)
  $tw = [int]([Math]::Round($tw * $scale))
  $th = [int]([Math]::Round($th * $scale))
}

$alreadySized = ([Math]::Abs($cur.W - $tw) -le 2) -and ([Math]::Abs($cur.H - $th) -le 2)
if ($inside -and $alreadySized -and -not $Force) {
  Write-Output ("[win] 已在主屏内且尺寸合适: " + $cur.L + "," + $cur.T + " " + $cur.W + "x" + $cur.H)
  exit 0
}

$x = $work.X + [int](($work.Width - $tw) / 2)
$y = $work.Y + [int](($work.Height - $th) / 2)
$SWP_NOZORDER = 0x0004
$SWP_NOACTIVATE = 0x0010
$ok = [WsaWin]::SetWindowPos($cur.Hwnd, [IntPtr]::Zero, $x, $y, $tw, $th, $SWP_NOZORDER -bor $SWP_NOACTIVATE)
Start-Sleep -Milliseconds 400
$after = [WsaWin]::All() | Where-Object { $_.Hwnd -eq $cur.Hwnd }
$rect = if ($after) { $after.L.ToString() + "," + $after.T.ToString() + " " + $after.W.ToString() + "x" + $after.H.ToString() } else { "?" }
Write-Output ("[win] " + ($(if ($ok) { "已移动/缩放" } else { "SetWindowPos 失败" })) + " -> " + $rect + "（目标 " + $x + "," + $y + " " + $tw + "x" + $th + "）")
[void][WsaWin]::SetForegroundWindow($cur.Hwnd)
if (-not $ok) { exit 1 }
