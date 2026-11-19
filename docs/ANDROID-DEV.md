# 安卓实时调试（热加载 + DevTools）

一句话：`bash scripts/android-dev.sh` 一条命令进调试态 —— 前端改代码 Vite 秒级 HMR，Rust 改代码自动重编重装，WebView 用 Chrome DevTools 调。

## 1. 前置事实（本机当前值，换机只改这张表）

| 项 | 值 |
|---|---|
| Android SDK | `C:/Users/sesa621561/AppData/Local/Android/Sdk`（**ANDROID_HOME 系统里没设**，脚本内导出） |
| NDK | `<SDK>/ndk/27.3.13750724`（clang 包装用 `x86_64-linux-android24-clang.cmd`） |
| Gradle 缓存 | `D:/dsh/cache/gradle`（gradle 9.6.1 发行版已缓存，别让它往 C 盘下） |
| 调试设备 | `127.0.0.1:58526`（Windows Subsystem for Android，x86_64） |
| 包名 | `com.househub.mobile` |
| devUrl | `apps/shell/src-tauri/tauri.conf.json` → `http://localhost:1420` |
| 日志 | `D:/dsh/cache/tmp/android-dev.log` |

## 2. 启动

```bash
bash scripts/android-dev.sh                    # WSA
bash scripts/android-dev.sh R58M12345AB        # 真机（USB 序列号）
ABI=arm64-v8a bash scripts/android-dev.sh      # 真机 arm64
```

脚本流水线（全流程不需要符号链接）：

1. 导出 `ANDROID_HOME` / `NDK_HOME` / `GRADLE_USER_HOME`，按 ABI 设 `CC_<target>`、`AR_<target>`、`CARGO_TARGET_<TARGET>_LINKER`
2. `adb connect` 等设备 `get-state = device`
3. `adb reverse tcp:1420 tcp:1420` + 每 3s 自愈守护（WSA 休眠/重连后自动补）
4. 复用已在跑的 Vite（`127.0.0.1:1420`），没有就 `pnpm exec vite` 起一个
5. `cargo build --target x86_64-linux-android` → `rm -f` 掉 jniLibs 里的旧链接 → `cp` 真实 `.so` → `./gradlew assembleUniversalDebug -x rustBuild*` → `adb install -r -t` → `am force-stop` + `monkey` 启动 → 取 devtools socket 并 `adb forward tcp:9222`
6. 之后每 2s 轮询 `src/`、`Cargo.toml`、`tauri.conf.json`、`capabilities/` 的 mtime，有改动就重跑 5

首次启动约 40s（增量 cargo 4s + gradle 10~20s + 安装 155MB）。

## 3. 为什么不用 `tauri android dev`

CLI 在编完 Rust 后要在 `apps/shell/src-tauri/gen/android/app/src/main/jniLibs/<abi>/` 里给 `.so` 建**符号链接**：

```
Failed to create a symbolic link from ...\libhouse_hub_lib.so (file clobbering enabled)
  : IO error: 系统找不到指定的文件。(os error 2)
```

根因是本机没有 `SeCreateSymbolicLinkPrivilege`（未开 Windows 开发者模式、非管理员）：

```powershell
New-Item -ItemType SymbolicLink -Path X -Target Y
# NewItemSymbolicLinkElevationRequired,Microsoft.PowerShell.Commands.NewItemCommand
```

这条路走不通，就算你把序列号当 DEVICE 传也没用（还会报 `Could not find an Android Emulator matching ...`）。
另外**必须** `--host 127.0.0.1`：不传时 CLI 会把 devUrl 换成宿主 LAN IP（本机 `10.225.8.97`），WSA 到 LAN IP 不通，且 Vite 绑 LAN IP 时 HMR 端口报 `listen EACCES`。

## 4. 热加载

| 改什么 | 生效方式 | 耗时 |
|---|---|---|
| 前端 `apps/web/**` | Vite HMR 推送到 WebView | <1s，不用重装 |
| Rust `src-tauri/src/**` | 脚本重编 + 重打包 + 重装 + 重启 | ~35s |
| `tauri.conf.json` / capabilities | 同上 | ~35s |

自测 HMR：往 `apps/web/src/styles/glass.css` 追加 `:root{--hmr-probe:hit;}`，4s 内在 DevTools 控制台执行

```js
getComputedStyle(document.documentElement).getPropertyValue('--hmr-probe')  // "hit"
```

## 5. DevTools

脚本启动后自动 `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`：

- 直接开 <http://127.0.0.1:9222> 或 Chrome `chrome://inspect`
- 重装后 socket 名会变（pid 变了），脚本每次 deploy 会重新 forward；手工补：

```bash
ADB=C:/Users/sesa621561/AppData/Local/Android/Sdk/platform-tools/adb.exe
"$ADB" -s 127.0.0.1:58526 shell 'cat /proc/net/unix | grep -o "@webview_devtools_remote_[0-9]*"'
"$ADB" -s 127.0.0.1:58526 forward tcp:9222 localabstract:webview_devtools_remote_2740
```

页面 URL 显示 `http://tauri.localhost/` 是正常的：Tauri 在 Android 上把 `devUrl` 经自定义协议代理，脚本标签里能看到 `@vite/client` 就是 dev 模式生效。

## 6. 排障

| 现象 | 处理 |
|---|---|
| `adb connect` 报 `(10061)` | WSA 休眠了：开始菜单打开 Windows Subsystem for Android，再跑脚本 |
| 白屏 / 无内容 | 看 `curl -s http://127.0.0.1:1420/` 是否有响应；再看 `adb reverse --list` 是否还在 |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | release 包用的是 `D:/dsh/cache/android/house-hub.jks`，debug 用 `~/.android/debug.keystore`：`adb uninstall com.househub.mobile` 再装 |
| HMR 不生效 | Vite 必须绑 `127.0.0.1`（`apps/web/vite.config.ts` 里 host 默认值已改），`adb reverse` 只连宿主 IPv4 |
| 端口 1420 被占 | 旧会话残留的 vite 进程：`netstat -ano | grep 1420` 找 pid，`taskkill /T /F /PID <pid>` |

