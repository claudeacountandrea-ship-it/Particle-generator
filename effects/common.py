"""
Shared utilities for all effect generators.
- Seeded RNG, circular mask, spritesheet assembly, noise helpers.
"""

from PIL import Image, ImageDraw, ImageChops, ImageFilter
import math
import numpy as np

# ── Seeded PRNG (deterministic, same as original) ──────────────────────

def make_rand(seed_val):
    """LCG random generator - reproducible across runs."""
    state = [seed_val]
    def rand():
        state[0] = (state[0] * 16807) % 2147483647
        return (state[0] - 1) / 2147483646
    return rand


# ── Circular mask with smooth falloff ──────────────────────────────────

def make_circular_mask(w, h, fade_start=0.35, fade_end=0.50):
    """Create circular alpha mask with smoothstep gradient."""
    cx, cy = w // 2, h // 2
    fs = int(w * fade_start)
    fe = int(w * fade_end)
    mask = Image.new('L', (w, h), 0)
    md = ImageDraw.Draw(mask)
    for r in range(fe, 0, -1):
        if r <= fs:
            v = 255
        else:
            frac = (r - fs) / max(1, fe - fs)
            frac = frac * frac * (3 - 2 * frac)  # smoothstep
            v = int(255 * (1.0 - frac))
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=v)
    return mask


def apply_circular_mask(img, fade_start=0.35, fade_end=0.50):
    """Apply circular mask to an RGBA image."""
    w, h = img.size
    mask = make_circular_mask(w, h, fade_start, fade_end)
    r, g, b, a = img.split()
    img.putalpha(ImageChops.multiply(a, mask))
    return img


# ── Noise helpers using opensimplex ────────────────────────────────────

try:
    from opensimplex import OpenSimplex
    _HAS_OPENSIMPLEX = True
except ImportError:
    _HAS_OPENSIMPLEX = False

_noise_instances = {}

def noise2(x, y, seed=0):
    """2D simplex noise in range [-1, 1]."""
    if not _HAS_OPENSIMPLEX:
        # Fallback: simple hash-based noise
        n = math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453
        return (n - math.floor(n)) * 2.0 - 1.0
    if seed not in _noise_instances:
        _noise_instances[seed] = OpenSimplex(seed=seed)
    return _noise_instances[seed].noise2(x, y)


def noise3(x, y, z, seed=0):
    """3D simplex noise in range [-1, 1]. z can be used as time."""
    if not _HAS_OPENSIMPLEX:
        n = math.sin(x * 12.9898 + y * 78.233 + z * 45.164 + seed) * 43758.5453
        return (n - math.floor(n)) * 2.0 - 1.0
    if seed not in _noise_instances:
        _noise_instances[seed] = OpenSimplex(seed=seed)
    return _noise_instances[seed].noise3(x, y, z)


def fbm(x, y, z=0.0, octaves=4, lacunarity=2.0, gain=0.5, seed=0):
    """Fractal Brownian Motion - layered noise for natural-looking textures."""
    value = 0.0
    amplitude = 1.0
    frequency = 1.0
    for _ in range(octaves):
        value += amplitude * noise3(x * frequency, y * frequency, z * frequency, seed=seed)
        amplitude *= gain
        frequency *= lacunarity
    return value


# ── Easing functions ───────────────────────────────────────────────────

def ease_in_quad(t):
    return t * t

def ease_out_quad(t):
    return t * (2 - t)

def ease_in_out_quad(t):
    return 2 * t * t if t < 0.5 else -1 + (4 - 2 * t) * t

def ease_in_cubic(t):
    return t * t * t

def ease_out_cubic(t):
    return 1 - (1 - t) ** 3

def ease_in_expo(t):
    return 0.0 if t == 0 else 2 ** (10 * (t - 1))

def ease_out_expo(t):
    return 1.0 if t == 1 else 1 - 2 ** (-10 * t)

def ease_power(t, power):
    return t ** power


# ── Color utilities ────────────────────────────────────────────────────

def lerp_color(c1, c2, t):
    """Linear interpolation between two RGBA tuples."""
    t = max(0.0, min(1.0, t))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(len(c1)))


def temperature_to_color(temp):
    """Map temperature (0=cold, 1=hot) to a color.
    Cold=deep blue -> warm=white -> hot=bright white-blue.
    """
    if temp < 0.3:
        t = temp / 0.3
        return lerp_color((40, 60, 180, 255), (180, 200, 255, 255), t)
    elif temp < 0.7:
        t = (temp - 0.3) / 0.4
        return lerp_color((180, 200, 255, 255), (255, 255, 255, 255), t)
    else:
        t = (temp - 0.7) / 0.3
        return lerp_color((255, 255, 255, 255), (220, 240, 255, 255), t)


# ── Drawing helpers ────────────────────────────────────────────────────

def draw_glow(draw, cx, cy, radius, color, intensity=1.0):
    """Draw a soft radial glow."""
    for r in range(int(radius), 0, -1):
        frac = r / radius
        a = int(color[3] * (1 - frac) * intensity)
        if a < 1:
            continue
        c = (color[0], color[1], color[2], a)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)


def draw_line_glow(draw, x1, y1, x2, y2, width, color, glow_radius=3):
    """Draw a glowing line with soft edges."""
    # Core line
    draw.line([(x1, y1), (x2, y2)], fill=color, width=max(1, int(width)))
    # Glow layers
    for g in range(1, glow_radius + 1):
        a = int(color[3] * (1 - g / (glow_radius + 1)) * 0.4)
        if a < 1:
            continue
        gc = (color[0], color[1], color[2], a)
        draw.line([(x1, y1), (x2, y2)], fill=gc, width=max(1, int(width + g * 2)))
