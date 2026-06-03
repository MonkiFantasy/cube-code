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
- URL/Deep Link 魔方码编码：支持普通 Web URL、`mailto:`, `tel:`, `myapp://...`, `intent://...` 等安全 scheme，解码后显示为可点击链接和“打开链接/应用”按钮。
- 普通模式固定 6 面分片。
- 面 payload：3-bit face ID + 13-bit chunk length + data chunk。
- 完整 payload：version + data type + content + CRC16。
- L/M/Q/H 纠错级别。
- 中心图标叠加。
- 独立模式：生成普通二维码，支持 1–6 个使用面。
- 独立模式空面图片。
- 容量实时提示（近似值）。

### 展示

- QR 网格展示。
- 十字展开图。
- 逐面查看。
- Three.js 3D 立方体。
- 前/后/上/下/左/右视角按钮。
- 色彩模式：炫彩、黑白、异色、异色炫彩。
- 材质：标准、玻璃、基因码。
- 基因码颜色：紫、红、蓝。
- 十字图 PNG 保存。

### 解码

- 魔方码摄像头扫描。
- 魔方码上传十字图扫描。
- 缺面提示。
- CRC 校验。
- 普通二维码摄像头扫描。
- 普通二维码上传图片扫描，包含整图、中心裁切和网格区域尝试。

### PWA / Android

- Vite PWA 插件已接入，替代手写 `public/sw.js`。
- PWA manifest 由 `vite-plugin-pwa` 生成，`start_url`/`scope` 跟随 `BASE_PATH`。
- Workbox generateSW。
- PWA 离线 fallback 页面：`public/offline.html`。
- PWA 图标已重绘：`public/icon-192.png`, `public/icon-512.png`。
- 应用内离线提示条：通过真实网络探测判断断网，断网时显示“离线魔方模式”（不再单纯依赖 `navigator.onLine`）。
- Android Capacitor 项目存在。
- Android 长按 data URL 图片保存到相册。
- GitHub Actions 有 CI、Android debug/release 构建。

### 测试

- `tests/utils.test.js`：底层工具函数。
- `tests/decoder.test.js`：重组、乱序、缺面、CRC 篡改、Unicode。

## 未实现 / 待开发

### 协议类型

- `0x01 = binary` 未实现。
- `0x02 = URL` 已基础实现，含 app deep link 跳转；仍未实现危险链接二次确认、scheme 白名单配置和更细的 URL 类型 UX。
- 二进制文件上传、分片、还原下载未实现。

### 容量管理

- 当前容量提示是近似值，基于 QR V40 byte capacity 和 base64 膨胀估算。
- 未根据 qrcode 库实际版本选择结果做精确容量反馈。
- 未对超长输入提供更详细的降级建议。

### 扫描能力

- 未实现任意角度多 QR 自动定位。
- 未实现透视校正。
- 未实现低光/模糊增强。
- 快速扫描仍是基础区域扫描。

### PWA

- 已接入自动 SW，但还没有 UI 更新提示。
- 未实现“发现新版本，点击刷新”。
- 离线兜底页已实现；仍可继续优化缓存清理和更新提示体验。

### 测试

- 未覆盖真实 QR 图片生成后再扫描。
- 未覆盖普通二维码扫码模式。
- 未覆盖 UI 交互。
- 未覆盖 PWA 产物。
- 未覆盖 Android 真机行为。

### 性能

- 构建仍提示 JS chunk > 500kB。
- 未做 Three.js / scanner 动态加载。

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
