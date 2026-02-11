"""
Fire / Smoke Effect
Procedural fire using layered noise with rising particles and ember sparks.
Inspired by PythonFireFx and "Simulating Fire With Texture Splats" techniques.
"""

from PIL import Image, ImageDraw, ImageFilter
import math
from .common import (
    make_rand, apply_circular_mask, noise3, fbm,
    ease_out_cubic, ease_in_quad, lerp_color, draw_glow
)

DEFAULT_CONFIG = {
    # Fire particles
    'particle_count': 200,
    'rise_speed_min': 0.5,
    'rise_speed_max': 1.2,
    'spread': 0.3,              # Horizontal spread ratio
    'particle_size_min': 3,
    'particle_size_max': 12,

    # Noise distortion
    'noise_scale': 0.008,       # Spatial frequency of noise
    'noise_strength': 40,       # Pixel displacement from noise
    'noise_time_speed': 3.0,    # Animation speed of noise field

    # Color ramp (bottom to top)
    'color_core': (255, 255, 220, 255),     # Hottest (bottom center)
    'color_inner': (255, 200, 50, 240),     # Inner flame
    'color_outer': (255, 100, 20, 200),     # Outer flame
    'color_tip': (200, 60, 20, 150),        # Flame tips
    'color_smoke': (80, 70, 65, 80),        # Smoke at top

    # Embers
    'ember_count': 30,
    'ember_size': 2,
    'ember_color': (255, 200, 100, 220),
    'ember_rise_speed': 0.8,
    'ember_wobble': 0.4,

    # Shape
    'flame_height': 0.7,        # Flame height as ratio of frame
    'flame_width': 0.3,         # Base width as ratio of frame
    'origin_y': 0.75,           # Vertical origin (0=top, 1=bottom)

    # Mask
    'mask_fade_start': 0.40,
    'mask_fade_end': 0.50,
}


def _make_fire_particles(seed, cfg):
    """Generate fire particle properties."""
    rand = make_rand(seed)
    particles = []
    for i in range(cfg['particle_count']):
        phase = rand()
        x_offset = (rand() - 0.5) * 2  # -1 to 1
        speed = cfg['rise_speed_min'] + rand() * (cfg['rise_speed_max'] - cfg['rise_speed_min'])
        size = cfg['particle_size_min'] + rand() * (cfg['particle_size_max'] - cfg['particle_size_min'])
        noise_seed = rand() * 1000.0
        particles.append({
            'phase': phase,
            'x_offset': x_offset,
            'speed': speed,
            'size': size,
            'noise_seed': noise_seed,
        })
    return particles


def _make_embers(seed, cfg):
    """Generate ember spark properties."""
    rand = make_rand(seed + 7777)
    embers = []
    for i in range(cfg['ember_count']):
        phase = rand()
        x_offset = (rand() - 0.5) * 1.5
        speed = cfg['ember_rise_speed'] * (0.5 + rand() * 0.5)
        noise_seed = rand() * 1000.0
        embers.append({
            'phase': phase,
            'x_offset': x_offset,
            'speed': speed,
            'noise_seed': noise_seed,
        })
    return embers


def _fire_color(height_ratio, cfg):
    """Get fire color based on normalized height (0=base, 1=tip)."""
    if height_ratio < 0.15:
        t = height_ratio / 0.15
        return lerp_color(cfg['color_core'], cfg['color_inner'], t)
    elif height_ratio < 0.45:
        t = (height_ratio - 0.15) / 0.30
        return lerp_color(cfg['color_inner'], cfg['color_outer'], t)
    elif height_ratio < 0.75:
        t = (height_ratio - 0.45) / 0.30
        return lerp_color(cfg['color_outer'], cfg['color_tip'], t)
    else:
        t = (height_ratio - 0.75) / 0.25
        return lerp_color(cfg['color_tip'], cfg['color_smoke'], t)


def render_frame(t, render_size, seed=55, cfg=None):
    """Render a single frame of fire effect.

    Args:
        t: Time in [0, 1) for one loop cycle.
        render_size: Output size (square).
        seed: Random seed.
        cfg: Config dict.

    Returns:
        PIL.Image (RGBA).
    """
    if cfg is None:
        cfg = DEFAULT_CONFIG

    cx = render_size // 2
    scale = render_size / 800.0
    origin_y = int(render_size * cfg['origin_y'])
    flame_h = render_size * cfg['flame_height']
    flame_w = render_size * cfg['flame_width']

    img = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    noise_t = t * cfg['noise_time_speed']
    particles = _make_fire_particles(seed, cfg)

    # ── Fire particles ──
    # Sort by size (larger behind)
    sorted_particles = sorted(particles, key=lambda p: -p['size'])

    for p in sorted_particles:
        # Progress through lifecycle (looping)
        progress = (t * p['speed'] + p['phase']) % 1.0

        # Vertical position (rises from origin)
        py = origin_y - progress * flame_h

        # Horizontal position with noise displacement
        base_x = cx + p['x_offset'] * flame_w * 0.5 * (1.0 - progress * 0.5)
        noise_dx = noise3(
            p['noise_seed'], py * cfg['noise_scale'], noise_t, seed=seed
        ) * cfg['noise_strength'] * scale
        # More displacement as flame rises
        noise_dx *= (0.3 + progress * 0.7)
        px = base_x + noise_dx

        # Width narrows as flame rises
        width_factor = 1.0 - progress * 0.8
        # Also narrow based on distance from center
        center_dist = abs(p['x_offset'])
        width_factor *= (1.0 - center_dist * 0.3)

        # Particle size
        sz = max(1, int(p['size'] * scale * width_factor))

        # Alpha: fade in at base, fade out at tips
        if progress < 0.05:
            alpha = progress / 0.05
        elif progress > 0.6:
            alpha = (1.0 - progress) / 0.4
        else:
            alpha = 1.0
        alpha *= width_factor

        if alpha < 0.01 or sz < 1:
            continue

        # Color based on height
        color = _fire_color(progress, cfg)
        pa = int(color[3] * alpha)
        if pa < 1:
            continue

        draw.ellipse(
            [px - sz, py - sz, px + sz, py + sz],
            fill=(color[0], color[1], color[2], pa)
        )

    # ── Base glow ──
    base_glow_r = int(flame_w * 0.6 * scale)
    draw_glow(draw, cx, origin_y, base_glow_r, cfg['color_core'], 0.4)

    # ── Embers ──
    embers = _make_embers(seed, cfg)
    for e in embers:
        progress = (t * e['speed'] + e['phase']) % 1.0
        ey = origin_y - progress * flame_h * 1.2
        ex = cx + e['x_offset'] * flame_w * 0.8

        # Wobble
        wobble_x = noise3(e['noise_seed'], progress * 5, noise_t, seed=seed + 100) * cfg['ember_wobble'] * flame_w * 0.3
        wobble_y = noise3(e['noise_seed'] + 50, progress * 5, noise_t, seed=seed + 100) * cfg['ember_wobble'] * flame_h * 0.1
        ex += wobble_x
        ey += wobble_y

        # Alpha
        if progress < 0.1:
            alpha = progress / 0.1
        elif progress > 0.5:
            alpha = (1.0 - progress) / 0.5
        else:
            alpha = 1.0

        if alpha < 0.01:
            continue

        es = max(1, int(cfg['ember_size'] * scale))
        ec = cfg['ember_color']
        ea = int(ec[3] * alpha)
        if ea > 0:
            draw.ellipse([ex - es, ey - es, ex + es, ey + es],
                         fill=(ec[0], ec[1], ec[2], ea))

    # Gaussian blur for soft look
    img = img.filter(ImageFilter.GaussianBlur(radius=max(1, int(2.0 * scale))))

    apply_circular_mask(img, cfg['mask_fade_start'], cfg['mask_fade_end'])
    return img
