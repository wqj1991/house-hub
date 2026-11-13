#!/usr/bin/env bash
# Android 发布包构建。本机 D: 盘（exFAT/受限）上 tauri CLI 的 jniLibs 符号链接会报
# "Failed to create a symbolic link ... (os error 2)"，所以这里走替代路径：
#   1) tauri android build 先把 .so 编出来（链接步骤失败可忽略）
#   2) 手工把 .so 拷进 jniLibs
#   3) 直接调 gradle assembleUniversalRelease，并 -x 掉会重新调 tauri 的 rust 任务
#   4) zipalign + apksigner 出可安装的 release APK
set -uo pipefail

TARGET="${1:-aarch64}"
case "$TARGET" in
  aarch64) ABI=arm64-v8a; ARCH=arm64 ;;
  armv7)   ABI=armeabi-v7a; ARCH=arm ;;
  i686)    ABI=x86; ARCH=x86 ;;
  x86_64)  ABI=x86_64; ARCH=x86_64 ;;
  *) echo "unknown target: $TARGET (aarch64|armv7|i686|x86_64)" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHELL_DIR="$ROOT/apps/shell"
ANDROID_DIR="$SHELL_DIR/src-tauri/gen/android"
SO="$SHELL_DIR/src-tauri/target/${TARGET}-linux-android/release/libhouse_hub_lib.so"
SDK="${ANDROID_HOME:-${LOCALAPPDATA:-$HOME/AppData/Local}/Android/Sdk}"
BT="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"
OUT="${OUT_DIR:-$ROOT/apps/shell/src-tauri/gen/android/app/build/outputs/apk/universal/release}"
KS="${KEYSTORE:-D:/dsh/cache/android/house-hub.jks}"
# 签名口令不写进仓库：优先用环境变量，其次读本地口令文件
if [ -z "${KEYSTORE_PASS:-}" ] && [ -f D:/dsh/cache/android/keystore.pass ]; then
  KEYSTORE_PASS="$(cat D:/dsh/cache/android/keystore.pass)"
fi
KS_PASS="${KEYSTORE_PASS:?需要 KEYSTORE_PASS 环境变量或 D:/dsh/cache/android/keystore.pass}"

echo "==> 1/4 编译 Rust（链接 jniLibs 会失败，忽略）"
(cd "$SHELL_DIR" && GRADLE_USER_HOME="${GRADLE_USER_HOME:-D:/dsh/cache/gradle}" pnpm exec tauri android build --target "$TARGET") || true
[ -f "$SO" ] || { echo "missing $SO — Rust 编译未产出 .so" >&2; exit 1; }

echo "==> 2/4 拷贝 .so 到 jniLibs/$ABI"
mkdir -p "$ANDROID_DIR/app/src/main/jniLibs/$ABI"
rm -f "$ANDROID_DIR/app/src/main/jniLibs/$ABI/libhouse_hub_lib.so"
cp "$SO" "$ANDROID_DIR/app/src/main/jniLibs/$ABI/"

echo "==> 3/4 gradle assembleUniversalRelease"
[ -f "$ANDROID_DIR/local.properties" ] || echo "sdk.dir=${SDK////\\}" > "$ANDROID_DIR/local.properties"
(cd "$ANDROID_DIR" && GRADLE_USER_HOME="${GRADLE_USER_HOME:-D:/dsh/cache/gradle}" \
  ./gradlew "assembleUniversalRelease" -PtargetList="$TARGET" -ParchList="$ARCH" -PabiList="$ABI" \
  -x "rustBuildUniversalRelease" -x "rustBuild${ARCH^}Release" --console=plain)

echo "==> 4/4 签名"
UNSIGNED="$(ls -t "$OUT"/*-unsigned.apk | head -1)"
mkdir -p D:/dsh/cache/android D:/dsh/downloads
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -alias househub -keyalg RSA -keysize 2048 \
  -validity 10000 -storepass "$KS_PASS" -keypass "$KS_PASS" \
  -dname "CN=YG, OU=Personal, O=House Hub, L=Beijing, ST=Beijing, C=CN"
"$BT/zipalign.exe" -f -p 4 "$UNSIGNED" D:/dsh/cache/android/app-aligned.apk
"$BT/apksigner.bat" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "D:/dsh/downloads/house-hub_0.2.0_${ABI}-release.apk" D:/dsh/cache/android/app-aligned.apk
"$BT/apksigner.bat" verify --print-certs "D:/dsh/downloads/house-hub_0.2.0_${ABI}-release.apk" | head -3
echo "done: D:/dsh/downloads/house-hub_0.2.0_${ABI}-release.apk"
