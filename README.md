# Cube Code 魔方码

> [English](./README.md) | [中文](./README.zh-CN.md)

A 3D QR code system that encodes data across six faces of a cube, providing ~6x the data capacity of a standard QR code. It also supports an independent ordinary-QR mode so any phone scanner can read a single face directly.

## Platforms

| Platform | Status | Download |
|----------|--------|----------|
| Web (PWA) | ✅ Supported | [Live Demo](https://monkifantasy.github.io/cube-code/) |
| Android | ✅ Supported | [Releases](https://github.com/MonkiFantasy/cube-code/releases) |

## Features

### Core

- **Cube Code Encoding/Decoding** — 6-face data splitting with L/M/Q/H error correction; URL/deep-link inputs are tagged and decoded as clickable links or app-launch links
- **Cross Net View** — Standard and playful flat layouts: classic cross, windmill, stair, snake, and tower
- **Face-by-Face View** — Browse each face individually
- **Multi-face Reassembly** — Normal mode uses all 6 faces and reconstructs data by face ID
- **Independent Mode** — Each used face is an ordinary QR code readable by system cameras, WeChat, and other common scanners
- **Independent Face Count** — Choose 1–6 QR faces only in independent mode
- **Empty Face Image** — Upload a custom image for unused faces in independent mode

### 3D Rendering

- **Interactive 3D Cube** — Drag to rotate, powered by Three.js
- **Face Navigation** — Quick buttons: Front / Back / Top / Bottom / Left / Right
- **Multiple Color Modes** — Colorful / Black & White / Contrast / Contrast Colorful
- **QR Center Icon** — Customizable icon in QR code center
- **Glass Material** — Transparent acrylic effect
- **Gene Material** — Purple / red / blue raised pixel-relief cube, fitted to the actual QR content bounds

### Mobile & Android

- **Responsive UI** — Optimized for mobile screens
- **PWA Installable** — Add to home screen on any device
- **Android APK** — Auto-built via GitHub Actions CI/CD
- **Native Image Save** — Long-press to save QR images to gallery
- **Camera Scan** — Real-time Cube Code scanning and plain QR scanning from camera
- **Image Upload** — Decode known Cube Code flat layouts automatically, or plain QR from gallery photos

### Internationalization

- **Chinese / English** — Full i18n support

## Concept

Traditional QR codes are 2D — data is encoded on a single plane. Cube Code distributes data across six cube faces:

- In normal mode, each face contains a protocol-wrapped QR code carrying one data chunk
- A **3-bit face ID** (`001`–`110`) identifies each face position
- After all six faces are scanned, chunks are ordered by face ID and reassembled
- In independent mode, each used face directly encodes the original text as an ordinary QR code, without Cube Code protocol wrapping

```
        [3]
  [5]  [1]  [6]  [2]
        [4]
```

## Data Capacity

| Mode         | Single QR (V40) | Cube Code (6 faces) |
|--------------|-----------------|----------------------|
| Numeric      | 7,089 chars     | ~42,534 chars        |
| Alphanumeric | 4,296 chars     | ~25,776 chars        |
| Byte         | 2,953 bytes     | ~17,718 bytes        |

## Protocol

In normal Cube Code mode, each face's QR payload is:

```
[3-bit face ID][13-bit chunk length][data chunk]
```

After scanning all 6 faces and ordering by face ID, the full data is reconstructed as:

```
[version][data type][content][CRC16]
```

| Field        | Size    | Description                               |
|--------------|---------|-------------------------------------------|
| Face ID      | 3 bits  | `001`–`110`, identifies face position      |
| Chunk length | 13 bits | Length of the current face chunk           |
| Version      | 1 byte  | Protocol version                           |
| Data type    | 1 byte  | `0x00`=text, `0x01`=binary, `0x02`=URL     |
| Content      | N bytes | Actual data split across 6 faces           |
| CRC16        | 2 bytes | Checksum of the complete reassembled data  |

> Independent mode does not use this protocol wrapping; each used face is a plain QR code containing the original input text.

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
npm run cap:sync         # Sync web assets to Android
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
