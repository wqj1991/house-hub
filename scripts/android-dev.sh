#!/usr/bin/env bash
# 安卓实时调试（WSA / 真机）：Vite HMR + Rust 改动自动重编重装 + WebView DevTools
#   bash scripts/android-dev.sh                 # WSA 127.0.0.1:58526
#   bash scripts/android-dev.sh R58M12345AB     # 真机
#   ABI=arm64-v8a bash scripts/android-dev.sh   # 真机 arm64
#
# 为什么不用 `tauri android dev`：它编完 Rust 后要在 app/src/main/jniLibs/<abi>/ 里给 .so
# 建符号链接；本机没有 SeCreateSymbolicLinkPrivilege（未开开发者模式/非管理员），
# PowerShell New-Item -ItemType SymbolicLink 报 NewItemSymbolicLinkElevationRequired，
# 于是 CLI 必然停在 failed to create a symbolic link ... (os error 2)。
# 这里改成 cargo build -> cp .so -> gradle assemble -> adb install -> am start，全程不需要符号链接。
#
# 单屏下 WSA 窗口看不到 / 只显示一条窄缝，原因和修法见我下面的 wsa_fit_task 与 wsa_guard_start：
# WSA 把每个包上次的窗口位置记在自己那边（settings.dat，WsaService 独占打开，外部改不了），
# 窗口活着时每 2-6 秒把窗口 SetWindowPos 回那条记录值。记录值来自以前的双屏布局（x=2563）时，
# 1920 宽的单屏上整个窗口就在屏外，界面什么都看不到；同时 WSA 用宿主窗口宽高比推导客户机
# override 分辨率，客户机里 app 的 freeform 任务又只有 625x1010 且 x=1184 超出 1320 宽，
# 于是宿主窗口里只剩右侧一条被裁掉的窄缝。
set -uo pipefail

SERIAL="${1:-127.0.0.1:58526}"
ABI="${ABI:-x86_64}"
if [ "$ABI" = "arm64-v8a" ]; then
  RUST_TARGET=aarch64-linux-android
  CLANG=aarch64-linux-android24-clang.cmd
  GRADLE_ARCH=arm64
else
  ABI=x86_64
  RUST_TARGET=x86_64-linux-android
  CLANG=x86_64-linux-android24-clang.cmd
  GRADLE_ARCH=x86_64
fi

SDK="${ANDROID_HOME:-C:/Users/sesa621561/AppData/Local/Android/Sdk}"
if [ -z "${NDK_HOME:-}" ]; then NDK_HOME=$(ls -d "$SDK"/ndk/*/ 2>/dev/null | sort -V | tail -1); fi
NDK_HOME="${NDK_HOME%/}"
BIN="$NDK_HOME/toolchains/llvm/prebuilt/windows-x86_64/bin"
export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK" NDK_HOME="$NDK_HOME"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-D:/dsh/cache/gradle}"
if [ "$ABI" = "x86_64" ]; then
  export CC_x86_64_linux_android="$BIN/$CLANG"
  export AR_x86_64_linux_android="$BIN/llvm-ar.exe"
  export CARGO_TARGET_X86_64_LINUX_ANDROID_LINKER="$BIN/$CLANG"
else
  export CC_aarch64_linux_android="$BIN/$CLANG"
  export AR_aarch64_linux_android="$BIN/llvm-ar.exe"
  export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="$BIN/$CLANG"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADB="$SDK/platform-tools/adb.exe"
PACKAGE=com.househub.mobile
SHELL_DIR="$ROOT/apps/shell/src-tauri"
SO="$SHELL_DIR/target/$RUST_TARGET/debug/libhouse_hub_lib.so"
JNI="$SHELL_DIR/gen/android/app/src/main/jniLibs/$ABI"
APK="$SHELL_DIR/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk"
STAMP="${DEV_STAMP:-D:/dsh/cache/tmp/android-dev.stamp}"
LOG="${DEV_LOG:-D:/dsh/cache/tmp/android-dev.log}"
API_LOG="${API_DEV_LOG:-D:/dsh/cache/tmp/api-dev.log}"
# 8787 落进本机 netsh 保留段（8699-8798）→ EACCES，默认用 18878
API_PORT="${API_PORT:-18878}"
API_DB="${HOUSE_DB_PATH:-D:/dsh/cache/house/house.db}"
API_TOKEN="${HOUSE_INTERNAL_TOKEN:-dev-internal-token}"
mkdir -p D:/dsh/cache/tmp 2>/dev/null; : > "$LOG"

say() { printf "[dev] %s\n" "$*" | tee -a "$LOG"; }
say "SDK=$SDK"
say "NDK=$NDK_HOME"
say "设备=$SERIAL ABI=$ABI target=$RUST_TARGET"

ready() { [ "$("$ADB" -s "$SERIAL" get-state 2>/dev/null)" = "device" ]; }
"$ADB" connect "$SERIAL" >/dev/null 2>&1
for _ in $(seq 1 40); do
  ready && break
  sleep 1
done
if ! ready; then
  case "$SERIAL" in
    127.0.0.1:*|localhost:*|emulator-*)
      # WSA 休眠时 58526 根本不监听：宿主侧把它拉起来，再等 adb 回归
      say "设备未就绪，拉起 Windows Subsystem for Android 并等待 adb 就绪…"
      cmd.exe //c start "" "shell:AppsFolder\MicrosoftCorporationII.WindowsSubsystemForAndroid_8wekyb3d8bbwe!App" >/dev/null 2>&1
      for _ in $(seq 1 45); do
        "$ADB" connect "$SERIAL" >/dev/null 2>&1
        ready && break
        sleep 2
      done
      ;;
  esac
fi
if ! ready; then
  say "设备未就绪：$SERIAL（WSA 休眠时先在开始菜单打开 Windows Subsystem for Android）"
  exit 1
fi

"$ADB" -s "$SERIAL" reverse tcp:1420 tcp:1420 >/dev/null 2>&1
"$ADB" -s "$SERIAL" reverse "tcp:$API_PORT" "tcp:$API_PORT" >/dev/null 2>&1
guard() {
  while :; do
    "$ADB" -s "$SERIAL" reverse --list 2>/dev/null | grep -q "tcp:1420 tcp:1420" \
      || "$ADB" -s "$SERIAL" reverse tcp:1420 tcp:1420 >/dev/null 2>&1
    "$ADB" -s "$SERIAL" reverse --list 2>/dev/null | grep -q "tcp:$API_PORT tcp:$API_PORT" \
      || "$ADB" -s "$SERIAL" reverse "tcp:$API_PORT" "tcp:$API_PORT" >/dev/null 2>&1
    sleep 3
  done
}
guard & GUARD_PID=$!
VITE_PID=
API_PID=
GUARD_WIN_PID=
# 窗口守卫的心跳文件：主循环每轮 touch 一次，守卫发现它 25s 没更新就自己退（脚本被硬杀时不会留孤儿）
GUARD_BEAT="D:/dsh/cache/tmp/android-dev.guard"
# 只有 WSA 需要宿主侧窗口纠偏；真机的窗口由手机自己管
case "$SERIAL" in
  127.0.0.1:*|localhost:*|emulator-*) WSA=1 ;;
  *) WSA=0 ;;
esac
# 收掉一个后台子进程：MSYS 的 kill 对原生 exe（powershell.exe / adb.exe / node.exe）有时留残，
# 200ms 后还在就 taskkill //T 连它的子进程一起收，再不行 kill -9。
kill_child() {
  local p="$1"
  [ -z "$p" ] && return 0
  kill "$p" 2>/dev/null
  sleep 0.2
  kill -0 "$p" 2>/dev/null || return 0
  taskkill //F //T //PID "$p" >/dev/null 2>&1 || kill -9 "$p" 2>/dev/null
}

# Ctrl-C 要真的停住整个脚本：老写法 trap 里只 kill 子进程、不 exit，SIGINT 只打断了
# 主循环的 sleep 2，循环接着转，表现就是“按了 Ctrl-C 没反应”。这里改成关一次就退出。
STOPPED=
cleanup() {
  local rc=$?
  [ -n "$STOPPED" ] && exit "$rc"
  STOPPED=1
  trap - EXIT INT TERM
  kill_child "$GUARD_PID"
  kill_child "${GUARD_WIN_PID:-}"
  rm -f "$GUARD_BEAT"
  kill_child "$VITE_PID"
  if [ -n "$API_PID" ]; then
    say "停止本次拉起的 API（pid $API_PID）"
    kill_child "$API_PID"
  fi
  say "已停止"
  exit "$rc"
}
trap cleanup EXIT INT TERM
say "reverse: 设备 tcp:1420 -> 宿主 127.0.0.1:1420、tcp:$API_PORT -> 宿主 127.0.0.1:$API_PORT（3s 自愈）"

if curl -s -m 2 -o /dev/null http://127.0.0.1:1420/; then
  if curl -s -m 2 -o /dev/null "http://127.0.0.1:1420/house-api/health"; then
    say "复用已在跑的前端 dev server（127.0.0.1:1420）"
  else
    say "前端在跑但 /house-api 代理不到 API：先停掉那个 vite 再重跑本脚本（它会把 HOUSE_API_URL 指到 $API_PORT）"
  fi
else
  say "启动前端 dev server（127.0.0.1:1420，HMR）"
  # HOUSE_API_URL：vite 的 /house-api 代理目标，默认 8787 在本机是 netsh 保留段（EACCES），必须指到本脚本起的端口
  ( cd "$ROOT/apps/web" && TAURI_DEV_HOST=127.0.0.1 HOUSE_API_URL="http://127.0.0.1:$API_PORT" pnpm exec vite >>"$LOG" 2>&1 ) &
  VITE_PID=$!
  for _ in $(seq 1 40); do
    curl -s -m 2 -o /dev/null http://127.0.0.1:1420/ && break
    sleep 1
  done
fi

API_HEALTH="http://127.0.0.1:$API_PORT/health"
if curl -s -m 2 -o /dev/null "$API_HEALTH"; then
  say "复用已在跑的 API（127.0.0.1:$API_PORT）"
else
  say "启动 API（127.0.0.1:$API_PORT，库 $API_DB，日志 $API_LOG）"
  : > "$API_LOG"
  ( cd "$ROOT" && PORT="$API_PORT" HOST=127.0.0.1 HOUSE_DB_PATH="$API_DB" \
      HOUSE_INTERNAL_TOKEN="$API_TOKEN" pnpm --filter @house/api start >>"$API_LOG" 2>&1 ) &
  API_PID=$!
  for _ in $(seq 1 40); do
    curl -s -m 2 -o /dev/null "$API_HEALTH" && break
    sleep 1
  done
  if curl -s -m 2 -o /dev/null "$API_HEALTH"; then
    say "API 就绪：$API_HEALTH"
  else
    say "API 没起来，看 $API_LOG（端口被占？换 API_PORT=xxxxx bash scripts/android-dev.sh）"
    tail -5 "$API_LOG" | tee -a "$LOG"
  fi
fi
say "配对码：curl -s -X POST -H 'x-internal-token: $API_TOKEN' http://127.0.0.1:$API_PORT/internal/pair/code"

build_rust() {
  say "cargo build --target $RUST_TARGET"
  ( cd "$SHELL_DIR" && cargo build --target "$RUST_TARGET" 2>&1 | tail -4 | tee -a "$LOG" )
  [ -f "$SO" ]
}

pack_apk() {
  mkdir -p "$JNI"
  rm -f "$JNI/libhouse_hub_lib.so"   # 存在的可能是符号链接（指向 target/…），先删链接再落真实文件
  cp "$SO" "$JNI/libhouse_hub_lib.so" || { say ".so 拷贝失败"; return 1; }
  say "gradle assembleUniversalDebug"
  ( cd "$SHELL_DIR/gen/android" && ./gradlew assembleUniversalDebug \
      -PtargetList="$ABI" -ParchList="$ABI" -PabiList="$ABI" \
      -x rustBuildUniversalDebug -x "rustBuild${GRADLE_ARCH}Debug" \
      --console=plain 2>&1 | grep -E "BUILD|error:|FAILURE" | tail -5 | tee -a "$LOG" )
  [ -f "$APK" ]
}

# 客户机当前分辨率（有 override 用 override，否则用物理分辨率）
wsa_guest_size() {
  local out ov ph
  out=$("$ADB" -s "$SERIAL" shell 'wm size' 2>/dev/null | tr -d '\r')
  ov=$(printf '%s\n' "$out" | awk '/Override size:/ {print $3}' | tail -1)
  ph=$(printf '%s\n' "$out" | awk '/Physical size:/ {print $3}' | tail -1)
  printf '%s\n' "${ov:-$ph}"
}

# WSA 把 app 的 freeform 任务摆在自己记的位置（实测 625x1010 @ x=1184，客户机只有 1320 宽），
# 宿主窗口里就只剩右侧一条被裁掉的窄缝。这里把任务撑满整块客户机显示，界面才是完整手机布局。
# 注意：任务 id 每次安装/重启都会变，所以每次 deploy 后都重新查。
wsa_fit_task() {
  local size tid
  size=$(wsa_guest_size)
  case "$size" in *x*) ;; *) say "读不到客户机分辨率，跳过窗口适配"; return 0 ;; esac
  tid=$("$ADB" -s "$SERIAL" shell 'am stack list' 2>/dev/null | tr -d '\r' \
        | grep -oE "taskId=[0-9]+: $PACKAGE/" | head -1 | grep -oE '[0-9]+')
  if [ -z "$tid" ]; then
    say "没找到 $PACKAGE 的任务，跳过窗口适配"
    return 0
  fi
  "$ADB" -s "$SERIAL" shell am task resize "$tid" 0 0 "${size%x*}" "${size#*x}" >>"$LOG" 2>&1
  say "客户机窗口撑满 ${size}（task $tid）"
}

# 宿主侧常驻纠偏：WSA 每 2-6 秒把窗口拉回它记的坐标，单屏时那个坐标在屏外；拖拽/SetWindowPos/
# WM_CLOSE 都验证过改不动那条记录（WSA 从不更新它），所以只能持续把窗口摁回主屏工作区。
wsa_guard_start() {
  local g="$ROOT/scripts/wsa-window-guard.ps1" gw
  if [ ! -f "$g" ]; then say "缺 $g，跳过窗口守卫"; return 0; fi
  command -v powershell.exe >/dev/null 2>&1 || { say "找不到 powershell.exe，跳过窗口守卫"; return 0; }
  # powershell.exe 只认 Windows 路径，Git Bash 的 /d/... 会被它当成不存在的文件
  gw=$(cygpath -w "$g" 2>/dev/null || printf '%s' "$g")
  : > "$GUARD_BEAT"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$gw" -Class "$PACKAGE" \
    -BeatFile "$GUARD_BEAT" -Quiet >>"$LOG" 2>&1 &
  GUARD_WIN_PID=$!
  say "窗口守卫已启动（pid $GUARD_WIN_PID）：WSA 把 $PACKAGE 窗口拉到屏外时立即摁回主屏"
}

deploy() {
  say "安装 + 启动 $PACKAGE"
  "$ADB" -s "$SERIAL" install -r -t "$APK" 2>&1 | tail -2 | tee -a "$LOG"
  "$ADB" -s "$SERIAL" shell am force-stop "$PACKAGE" >>"$LOG" 2>&1
  "$ADB" -s "$SERIAL" shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >>"$LOG" 2>&1
  sleep 3
  [ "$WSA" = 1 ] && wsa_fit_task
  SOCK=$("$ADB" -s "$SERIAL" shell 'cat /proc/net/unix | grep -o "@webview_devtools_remote_[0-9]*"' 2>/dev/null | head -1 | tr -d "\r")
  if [ -n "$SOCK" ]; then
    "$ADB" -s "$SERIAL" forward tcp:9222 "localabstract:${SOCK#@}" >/dev/null 2>&1
    say "DevTools: http://127.0.0.1:9222 （$SOCK）"
  fi
}

touch "$STAMP"
say "首次构建"
build_rust && pack_apk && deploy
[ "$WSA" = 1 ] && wsa_guard_start
touch "$STAMP"
say "监听中：Rust 改动自动重编重装；前端改动由 Vite HMR 即时生效（Ctrl-C 退出）"
while :; do
  : > "$GUARD_BEAT"
  sleep 2
  CHANGED=$(find "$SHELL_DIR/src" "$SHELL_DIR/Cargo.toml" "$SHELL_DIR/tauri.conf.json" \
             "$SHELL_DIR/capabilities" -type f -newer "$STAMP" 2>/dev/null | head -5)
  if [ -n "$CHANGED" ]; then
    say "检测到变更：$(echo "$CHANGED" | tr "\n" " ")"
    touch "$STAMP"
    build_rust && pack_apk && deploy
    touch "$STAMP"
    say "重装完成，等待下次改动"
  fi
  if [ "$("$ADB" -s "$SERIAL" get-state 2>/dev/null)" != "device" ]; then
    "$ADB" connect "$SERIAL" >/dev/null 2>&1
  fi
done
