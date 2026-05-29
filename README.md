# Cube Code 魔方码

> [English](./README.md) | [中文](./README.zh-CN.md)

A 3D QR code system that encodes data across six faces of a cube, providing ~6x the data capacity of a standard QR code.

## Platforms

| Platform | Status | Download |
|----------|--------|----------|
| Web (PWA) | ✅ Supported | [Live Demo](https://monkifantasy.github.io/cube-code/) |
| Android | ✅ Supported | [Releases](https://github.com/MonkiFantasy/cube-code/releases) |
| iOS | ❌ Planned | — |

## Features

### Core

- **QR Encoding/Decoding** — 6-face data splitting with L/M/Q/H error correction
- **Cross Net View** — Standard cube unfolded layout
- **Face-by-Face View** — Browse each face individually
- **Variable Face Count** — Use 1–6 faces based on data size
- **Independent Mode** — Each face can be decoded independently

### 3D Rendering

- **Interactive 3D Cube** — Drag to rotate, powered by Three.js
- **Face Navigation** — Quick buttons: Front / Back / Top / Bottom / Left / Right
- **Multiple Color Modes** — Colorful / Black & White / Contrast / Contrast Colorful
- **QR Center Icon** — Customizable icon in QR code center
- **Glass Material** — Transparent acrylic effect
- **Season Code** — Purple / Red / Blue cube-style modules

### Mobile & Android

- **Responsive UI** — Optimized for mobile screens
- **PWA Installable** — Add to home screen on any device
- **Android APK** — Auto-built via GitHub Actions CI/CD
- **Native Image Save** — Long-press to save QR images to gallery
- **Camera Scan** — Real-time QR scanning from camera
- **Image Upload** — Decode QR from gallery photos

### Internationalization

- **Chinese / English** — Full i18n support

## Protocol

Each face's QR code payload:

```
[3-bit face ID] + [data chunk]
```

After scanning all 6 faces and ordering by face ID, the full data is reconstructed:

```
[version][data type][content][CRC16]
```

| Field     | Size    | Description                               |
|-----------|---------|-------------------------------------------|
| Face ID   | 3 bits  | 001–110, identifies face position         |
| Version   | 1 byte  | Protocol version                          |
| Data type | 1 byte  | 0x00=text, 0x01=binary, 0x02=url         |
| Content   | N bytes | The actual data, split across 6 faces     |
| CRC16     | 2 bytes | Checksum of the complete reassembled data |

## Data Capacity

| Mode         | Single QR (V40) | Cube Code (6 faces) |
|--------------|-----------------|----------------------|
| Numeric      | 7,089 chars     | ~42,534 chars        |
| Alphanumeric | 4,296 chars     | ~25,776 chars        |
| Byte         | 2,953 bytes     | ~17,718 bytes        |

## Development

```bash
npm install
npm run dev
```

Open https://localhost:5173 in your browser (self-signed cert, accept the warning).

Camera access requires HTTPS — the dev server uses a self-signed certificate automatically.

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm test` | Run tests |
| `npm run lint` | Run linter |

### Android Development

```bash
npm run cap:sync        # Sync web assets to Android
npm run cap:open:android # Open in Android Studio
```

### Release

Releases are automated via GitHub Actions:

```bash
# Via tag
git tag v1.0.0
git push origin v1.0.0

# Or via GitHub Actions → Release Android APK → Run workflow
```

## Tech Stack

- Vanilla HTML/CSS/JS — zero framework overhead
- [Three.js](https://threejs.org/) — 3D rendering
- [qrcode](https://www.npmjs.com/package/qrcode) — QR code generation
- [jsQR](https://www.npmjs.com/package/jsqr) — QR code scanning
- [Capacitor](https://capacitorjs.com/) — Native Android wrapper
- [Vite](https://vite.dev/) — Dev server and build tool
- [Vitest](https://vitest.dev/) — Unit testing

## License

MIT

---

via [HAPI](https://hapi.run)
