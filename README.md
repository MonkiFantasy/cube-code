# Cube Code

A 3D QR code system that encodes data across six faces of a cube, providing ~6x the data capacity of a standard QR code. Runs entirely in the browser — no server needed.

## Concept

Traditional QR codes are 2D — data is encoded on a single flat surface. Cube Code distributes data across all six faces of a cube:

- Each face carries a standard QR code with **1/6 of the total data**
- A **3-bit header** (001–110) identifies each face's position
- A **human-readable digit** (1–6) is embedded in the center of each QR code for visual identification
- Data is reassembled by scanning all six faces and ordering by face ID

```
┌───────┐ ┌───────┐ ┌───────┐
│ ┌───┐ │ │ ┌───┐ │ │ ┌───┐ │
│ │ 1 │ │ │ │ 2 │ │ │ │ 3 │ │
│ └───┘ │ │ └───┘ │ │ └───┘ │
└───────┘ └───────┘ └───────┘
┌───────┐ ┌───────┐ ┌───────┐
│ ┌───┐ │ │ ┌───┐ │ │ ┌───┐ │
│ │ 4 │ │ │ │ 5 │ │ │ │ 6 │ │
│ └───┘ │ │ └───┘ │ │ └───┘ │
└───────┘ └───────┘ └───────┘
```

## Data Capacity

| Mode         | Single QR (V40) | Cube Code (6 faces) |
|--------------|-----------------|----------------------|
| Numeric      | 7,089 chars     | ~42,534 chars        |
| Alphanumeric | 4,296 chars     | ~25,776 chars        |
| Byte         | 2,953 bytes     | ~17,718 bytes        |

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

## Use Cases

- **Anti-counterfeiting** — 3D structure is hard to replicate
- **Industrial part labeling** — 6x capacity for serial numbers, specs, batch info
- **Offline data transfer** — ~17 KB via a physical cube, no network needed
- **Secure key distribution** — key fragments across 6 faces, all required to reconstruct
- **AR entry points** — each face stores data for a different AR scene

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Tech Stack

- Vanilla HTML/CSS/JS — zero framework overhead
- qrcode — QR code generation
- jsQR — QR code scanning from camera
- Vite — dev server and build tool

## License

MIT
