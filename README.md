# Particle VFX Spritesheet Generator

Multi-effect procedural spritesheet generator optimized for **Roblox ParticleEmitter** flipbooks.

## Effects

| Effect | Description |
|--------|-------------|
| `energy` | Particles converge to center in a perfect loop (energy accumulation) |
| `lightning` | Electric arcs with midpoint displacement, branching, and flicker |
| `explosion` | Expanding burst with debris, shockwave ring, and smoke |
| `fire` | Procedural fire with noise distortion, rising particles, and embers |

## Setup

```bash
pip install -r requirements.txt
```

Dependencies: `Pillow`, `opensimplex`, `numpy`

## Usage

```bash
# Generate all effects (default: 4096x4096, 8x8 grid = 64 frames)
python generate.py

# Single effect
python generate.py --effect energy

# Custom settings
python generate.py --effect lightning --grid 8 --size 4096

# Multiple variants
python generate.py --effect explosion --variants 2

# Energy with color mode
python generate.py --effect energy --color blue

# List effects
python generate.py --list
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--effect, -e` | all | Effect name (`energy`, `lightning`, `explosion`, `fire`) |
| `--size, -s` | 4096 | Spritesheet pixel size (square) |
| `--grid, -g` | 8 | Grid dimension (8 = 8x8 = 64 frames) |
| `--render-mult, -r` | 2 | Supersampling factor |
| `--seed` | per-effect | Random seed for reproducibility |
| `--variants, -v` | 1 | Number of variants (rotated/phase-shifted) |
| `--output, -o` | `.` | Output directory |
| `--color, -c` | white | Energy effect color: `white`, `blue`, `warm` |

## Roblox Setup

1. Upload the spritesheet PNG as a Decal/Image asset
2. On your `ParticleEmitter`:
   - `FlipbookLayout` = **Custom**
   - `FlipbookSizeX` = grid value (e.g. **8**)
   - `FlipbookSizeY` = grid value (e.g. **8**)
   - `FlipbookMode` = **Loop**
   - `FlipbookFramerate` = **16-30** (adjust to taste)

Roblox supports custom flipbook layouts with textures up to 4096x4096.

## Preview

Open `preview.html` in a browser to preview all effects in real-time with controls for effect switching, FPS, and background color.

## Architecture

```
generate.py          # Main CLI - spritesheet assembly and export
effects/
  __init__.py
  common.py          # Shared: noise, masks, easing, drawing utils
  energy.py          # Energy accumulation effect
  lightning.py       # Lightning/electric arc effect
  explosion.py       # Explosion with debris effect
  fire.py            # Fire/smoke effect
preview.html         # Browser-based real-time preview
```

Each effect module exports `render_frame(t, render_size, seed, cfg)` and `DEFAULT_CONFIG`.

## Techniques Used

- **OpenSimplex noise** for organic wobble, displacement, and procedural textures
- **Fractal Brownian Motion** (fBm) for layered natural-looking distortion
- **Midpoint displacement** algorithm for lightning bolt generation
- **Painter's algorithm** depth sorting for particle rendering
- **Supersampled rendering** with LANCZOS downscaling for anti-aliasing
- **Smoothstep circular masking** for clean particle boundaries
