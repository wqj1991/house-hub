# 安卓发版：装包与启动

一句话：`scripts/build-android.sh` 出 APK → `adb install -r` 装到设备 → `monkey` 拉起。**每次发版 app 都要跑这三步**，命令固定，只换 APK 路径。

## 环境事实（本机当前值，换机/换设备时只改这张表）

| 项 | 值 |
|---|---|
| adb 路径 | `C:/Users/sesa621561/AppData/Local/Android/Sdk/platform-tools/adb.exe`（1.0.41，37.0.0） |
| 设备序列号 | `127.0.0.1:58526`（Windows Subsystem for Android™，abilist = `x86_64,arm64-v8a,x86,armeabi-v7a,armeabi`） |
| 包名 / applicationId | `com.househub.mobile`（`apps/shell/src-tauri/gen/android/app/build.gradle.kts:22`） |
| APK 产物 | `D:/dsh/downloads/house-hub_<version>_<ABI>-release.apk`（`scripts/build-android.sh:65`） |

## 1. 确认设备在线

```bash
ADB="/c/Users/sesa621561/AppData/Local/Android/Sdk/platform-tools/adb.exe"
"$ADB" devices          # 要看到 127.0.0.1:58526  device
```

不在列表里、显示 `offline`，或 `connect` 报 `cannot connect to 127.0.0.1:58526: ... (10061)`：

1. 先确认 **Windows Subsystem for Android 本体在跑**（58526 是它的 adb 端口，WSA 没起或已休眠时端口根本不监听 → 10061 积极拒绝）。从开始菜单打开「Windows Subsystem for Android」，等它进主界面。
2. 再重连。旧的 `offline` 条目要先踢掉，否则 connect 会直接复用坏连接：

```bash
"$ADB" disconnect 127.0.0.1:58526
"$ADB" kill-server && "$ADB" start-server   # 仍连不上时重启 adb server
"$ADB" connect 127.0.0.1:58526
"$ADB" devices                              # 必须变成 device 再往下走
```

这是**网络** adb 连接，不是 USB —— WSA 休眠/重启后序列号会掉回 `offline`，所以每次发版第一步都先 `devices` 看一眼。

## 2. 安装（-r 覆盖装，保留数据）

```bash
"$ADB" -s 127.0.0.1:58526 install -r "D:/dsh/downloads/xxx.apk"
```

正常输出含 `Performing Streamed Install` 和 `Success`。

## 3. 启动

```bash
"$ADB" -s 127.0.0.1:58526 shell monkey -p com.househub.mobile -c android.intent.category.LAUNCHER 1
```

`-c android.intent.category.LAUNCHER` 限定只发 LAUNCHER 类别，末尾的 `1` 是事件次数，别漏。

## 一次拷走（发版默认用这段）

```bash
ADB="/c/Users/sesa621561/AppData/Local/Android/Sdk/platform-tools/adb.exe"
APK="D:/dsh/downloads/house-hub_0.2.0_arm64-release.apk"   # 换成当次产物
"$ADB" -s 127.0.0.1:58526 install -r "$APK" && \
"$ADB" -s 127.0.0.1:58526 shell monkey -p com.househub.mobile -c android.intent.category.LAUNCHER 1
```

## 排错

| 现象 | 处理 |
|---|---|
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match` | 签名变了（换过 keystore，或机器上原来装的是 debug 包）：`"$ADB" -s 127.0.0.1:58526 uninstall com.househub.mobile` 后重装。**会清掉 App 本地数据** |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | 包 ABI 设备不支持。本机 WSA 走 arm64 转译，装 `arm64-v8a` 或 `x86_64` 包 |
| `monkey` 输出 `No activities found to run` | 包名不对或没装：`"$ADB" -s 127.0.0.1:58526 shell pm list packages \| grep househub`；再 `"$ADB" -s 127.0.0.1:58526 shell cmd package resolve-activity --brief com.househub.mobile` 核对入口 activity |
| 装上了但点开闪退 | `"$ADB" -s 127.0.0.1:58526 logcat -c` → 再启动 → `"$ADB" -s 127.0.0.1:58526 logcat \| grep -iE "AndroidRuntime\|RustStdoutStderr\|house"` |
| `error: device offline` | `"$ADB" disconnect 127.0.0.1:58526` → `connect 127.0.0.1:58526`；仍失败见第 1 节（WSA 多半没跑） |
| `cannot connect to 127.0.0.1:58526: ... (10061)` | 端口没监听 = WSA 未启动/已挂起，先打开「Windows Subsystem for Android」，再 connect |
| `127.0.0.1:58526   unauthorized` | 冷启动刚连上、RSA 授权还没落地：等 20–30 秒再 `devices`；一直是 unauthorized 就去 WSA 设置开「开发人员模式」（Developer → USB debugging） |
| `device '127.0.0.1:58526' not found` | WSA 还在启动（58526 要冷启动后 30–60 秒才稳定监听）或已退出，重复 `connect` 直到 `devices` 显示 `device` |
| `more than one device/emulator` | 所有命令都带 `-s 127.0.0.1:58526` |

## 核对装的是哪一版

```bash
"$ADB" -s 127.0.0.1:58526 shell dumpsys package com.househub.mobile | grep -E "versionName|primaryCpuAbi|lastUpdateTime"
```

本机 2026-11-16 实测：`versionName=0.2.0`、`primaryCpuAbi=arm64-v8a`、`lastUpdateTime=2026-11-16 13:06:47`。

## 与构建脚本的分工

`scripts/build-android.sh` 只负责**出包**：编译 Rust .so → 拷到 jniLibs → `gradle assembleUniversalRelease` → zipalign/apksigner 签名，末尾打印产物路径。**装包和启动不在这支脚本里**，按本文第 2、3 步跑。
