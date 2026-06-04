# Cube Code 开发状态清单

用于新 agent / 新会话快速接手项目。

详细待开发事项见 [`docs/TODO.md`](./TODO.md)。

## 用户偏好 / 工作习惯

- 主要在 `dev` 分支开发。
- 完成功能后需要及时测试、提交并 push 到 `origin/dev`。
- 回答优先使用中文。
- 功能说明要区分“已实现”和“未实现/待完善”，不要把 README 目标当成已经实现。
- 用户希望按钮和交互尽量简单直观，不喜欢按钮太多且状态含糊。

## 当前已实现

### 编码

- 文本魔方码编码。
- URL/Deep Link 魔方码编码：支持普通 Web URL、`mailto:`, `tel:`, `myapp://...`, `intent://...` 等安全 scheme，解码后显示为可点击链接和“打开链接/应用”按钮；打开前会显示外部链接确认弹窗、scheme/host 和 intent fallback。
- 普通模式固定 6 面分片。
- 面 payload：3-bit face ID + 13-bit chunk length + data chunk。
- 完整 payload：version + data type + content + CRC16。
- L/M/Q/H 纠错级别。
- 中心图标叠加。
- 独立模式：生成普通二维码，支持 1–6 个使用面。
- 独立模式空面图片。
- 容量实时提示：先显示近似值，再用 `qrcode` 实际生成能力做精确可生成检查；编码前也会预检查并给出超容量建议。

### 展示

- QR 网格展示。
- 多种展开图：经典十字、风车、阶梯、蛇形、塔式。
- 逐面查看。
- Three.js 3D 立方体。
- 前/后/上/下/左/右视角按钮。
- 色彩模式：炫彩、黑白、异色、异色炫彩。
- 材质：标准、玻璃、基因码。
- 基因码颜色：紫、红、蓝。
- 十字图 PNG 保存。

### 解码

- 魔方码摄像头扫描。
- 魔方码上传图片扫描：自动尝试所有已知展开图布局，并加入灰度/对比度/反色/放大/重叠网格增强。
- 缺面提示。
- CRC 校验。
- 普通二维码摄像头扫描。
- 普通二维码上传图片扫描，包含整图、中心裁切、重叠网格、灰度/对比度/反色/放大增强。
- 普通二维码模式下隐藏重组/重置控件，扫码结果可复制，并明确提示“扫到即显示，不需要六面重组”。

### PWA / Android

- Vite PWA 插件已接入，替代手写 `public/sw.js`。
- PWA manifest 由 `vite-plugin-pwa` 生成，`start_url`/`scope` 跟随 `BASE_PATH`。
- Workbox generateSW。
- PWA 离线 fallback 页面：`public/offline.html`。
- PWA 新版本提示条：发现新版本后可点击刷新更新。
- 页面底部展示当前版本号和 Git 短 hash，方便确认 PWA 是否已更新到最新构建。
- PWA 图标已重绘：`public/icon-192.png`, `public/icon-512.png`。
- 应用内离线提示条：仅在浏览器安装的 PWA 独立窗口中启用，通过真实网络探测判断断网；普通浏览器标签页和 Capacitor Android APK 不显示，避免本地壳启动时误报断网。
- Android Capacitor 项目存在。
- Android 长按 data URL 图片保存到相册。
- GitHub Actions 有 CI、Android debug/release 构建。

### 测试

- `tests/utils.test.js`：底层工具函数。
- `tests/decoder.test.js`：重组、乱序、缺面、CRC 篡改、Unicode。
- `tests/qr-image.test.js`：真实 QR 图像经 jsQR 解码、普通二维码上传路径、URL/deep link、中心图标、全部颜色方案扫描性、实际容量检查。
- `tests/url-utils.test.js`：URL/Deep Link 安全判断和 intent fallback 解析。
- `e2e/app.spec.js`：Playwright UI 自动化，覆盖普通二维码模式、容量提示、URL/intent 弹窗、PWA 更新提示、版本号展示。

## 未实现 / 待开发

### 协议类型

- `0x01 = binary/file` 当前决定先不实现：容量太小，更适合用 URL 指向外部文件。
- `0x02 = URL` 已实现基础编码/解码、app deep link 跳转和打开前确认；仍未实现可配置 scheme 白名单。

### 容量管理

- 容量提示已加入 `qrcode` 实际生成检查和超容量建议。
- 仍未给出精确“剩余可输入字节数”。

### 扫描能力

- 未实现任意角度多 QR 自动定位。
- 未实现透视校正。
- 上传图片已有基础低光/对比度增强，但未实现透视校正。
- 摄像头快速扫描仍是基础区域扫描，未实现真正多 QR 定位。

### PWA

- 已接入 SW 和 UI 更新提示。
- 已实现“发现新版本，点击刷新”。
- 离线兜底页已实现；仍可继续优化缓存清理和版本展示体验。

### 测试

- 真实 QR 图片基础扫描测试已覆盖，但未覆盖模糊/低光/透视等拍照退化场景。
- 普通二维码上传路径已有自动化测试；摄像头实时扫码仍未覆盖。
- UI 交互已有 Playwright 基础覆盖，但生成完整流程和离线真实场景仍需补充。
- 未覆盖 PWA 产物。
- 未覆盖 Android 真机行为。

### 性能

- 已做首屏拆包：`qrcode`、`jsQR`、Three.js 改为按需加载。
- 首屏主入口构建后约 27 kB；Three.js core 约 520 kB，仅打开 3D 视图时加载。
- 还未替换/进一步瘦身 Three.js。

## 重要命令

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
npm test
npm run lint
npm run build
```

## 部署/base 说明

- 绑定自定义域名时通常使用根路径 `/`。
- GitHub Pages 子路径部署时才需要类似 `/cube-code/`。
- 当前 `vite.config.js` 使用：`base: process.env.BASE_PATH || '/'`。

## 当前本地服务

开发服务通常跑在：

```text
https://localhost:5173/
```
