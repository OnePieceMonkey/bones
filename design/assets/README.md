# Bones visual assets

Generated with Magnific on 2026-11-15 for the visual-polish spec. Target look: `design/mockups/bones-7-retro-b.png` (main), `bones-5-final-a.png` (hover box), `bones-3-hover-doctor-a.png` (ECG line, Dr. Bones), `bones-4-fracture-a.png` (splinters, cracked card).

All files are WebP, sized for the web. Black backgrounds are meant for `mix-blend-mode: screen` (black disappears, light stays). Cut-outs have a transparent background.

| File | What it is | How to use |
|---|---|---|
| `skeleton.webp` (1208x1800) | Full-body X-ray skeleton, black background | Lightbox centre, `mix-blend-mode: screen`. Crop with `object-position` so skull to upper thigh shows (image y 3 % to 65 %). |
| `film.webp` | Empty X-ray film, dark teal clouds | Lightbox background, under the skeleton |
| `light-cone.webp` | Cyan light cone from top, black background | Over the lightbox top centre, `screen`, slow flicker |
| `brushed-steel.webp` | Brushed steel, tileable | Metal frame and control panel (`background-size` about 512px) |
| `screw.webp` | Slotted screw head, cut-out | Frame corners and panel corners, random rotation per screw |
| `knob.webp` | Black bakelite knob, white pointer at 12 o'clock, cut-out | Rule version dial. Rotate the image; v1/v2/v3 labels in code |
| `meter.webp` | Analog meter, cream dial, no needle, cut-out | AI confidence meter. Needle and pivot drawn in SVG over the dial arc |
| `toggle.webp` | Chrome toggle, lever DOWN, cut-out | X-ray switch. Off = as is, on = `scaleY(-1)` with a short snap |
| `lamp.webp` | Amber indicator lamp, unlit, cut-out | Next to the toggle. Lit = CSS glow (`drop-shadow` + brightness) |
| `receipt-paper.webp` | Blank crumpled paper strip, cut-out | Document panel. Real text rendered on top in a mono font |
| `clip.webp` | Bulldog clip, cut-out | Two clips holding the paper to the film |
| `glass-cracks.webp` | White glass cracks, black background | Over the AI answer card when a field is overruled, `screen`, low opacity |
| `fracture-burst.webp` | Red crack burst with embers, black background | On a fractured bone anchor, `screen`, scale-in when the bone breaks |
| `splinters/splinter-1..8.webp` | Single bone shards with red edges, black background | Particles that fly out from the fracture, `screen` |
| `stamp-frame.webp` | Worn red ink rectangle, transparent | Frame of the "OVERRULED BY RULE" stamp; text in code |
| `dr-bones.webp` | Skull radiologist avatar | Round crop (head) in the Dr. Bones panel header |

## Bone anchors on `skeleton.webp`

Percent of the full image (x from left, y from top), as the viewer sees it.

| Region | x % | y % |
|---|---|---|
| skull | 50 | 9 |
| ribs | 57 | 29 |
| spine (upper) | 50 | 33 |
| spine (lower) | 50 | 42 |
| pelvis | 56 | 47 |
| arm-right (viewer's right forearm) | 69 | 45 |
| arm-left (viewer's left forearm) | 31 | 45 |
| ECG line | runs across at | 50 |

Source images live in the Magnific project "Bones Kiroween".
