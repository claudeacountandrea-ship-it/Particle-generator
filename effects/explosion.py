"""
Explosion Effect
Generates expanding burst with debris particles, shockwave ring, and flash.
Designed for single-play or loop (energy builds -> explodes -> resets).
"""

from PIL import Image, ImageDraw, ImageFilter
import math
from .common import (
    make_rand, apply_circular_mask, noise3,
    ease_out_expo, ease_out_cubic, ease_in_quad,
    draw_glow
)

DEFAULT_CONFIG = {
    # Debris particles
    'debris_count': 120,
    'debris_speed_min': 0.3,
    'debris_speed_max': 1.0,
    'debris_size_min': 2,
    'debris_size_max': 8,
    'debris_trail_length': 3.0,    # Trail length multiplier
    'debris_fade_start': 0.4,      # When debris starts fading

    # Shockwave ring
    'shockwave': True,
    'shockwave_speed': 0.9,        # How fast ring expands (ratio of max)
    'shockwave_width': 0.06,       # Ring thickness (ratio)
    'shockwave_fade': 0.6,         # When shockwave starts fading

    # Central flash
    'flash_duration': 0.15,
    'flash_radius_max': 0.15,      # As ratio of render size
    'flash_color': (255, 250, 230, 255),

    # Smoke (residual after explosion)
    'smoke_enabled': True,
    'smoke_particle_count': 40,
    'smoke_start': 0.3,            # When smoke appears
    'smoke_expand_speed': 0.15,
    'smoke_color': (180, 160, 140, 100),

    # Colors
    'hot_color': (255, 255, 220, 255),     # Near center / early
    'warm_color': (255, 180, 60, 255),     # Mid
    'cool_color': (200, 80, 30, 200),      # Far / late
    'spark_color': (255, 240, 200, 255),

    # Mask
    'mask_fade_start': 0.40,
    'mask_fade_end': 0.50,

    # Timing: 'oneshot' or 'loop'
    'timing': 'loop',
    # For loop mode: fraction of cycle spent on build-up before blast
    'buildup_fraction': 0.15,
}


def _make_debris(seed, cfg):
    """Generate debris particle properties."""
    rand = make_rand(seed)
    debris = []
    for i in range(cfg['debris_count']):
        angle = rand() * math.pi * 2
        speed = cfg['debris_speed_min'] + rand() * (cfg['debris_speed_max'] - cfg['debris_speed_min'])
        size = cfg['debris_size_min'] + rand() * (cfg['debris_size_max'] - cfg['debris_size_min'])
        # Color temperature (0=hot, 1=cool) correlates with speed
        temp = 0.2 + rand() * 0.6
        # Angular spread (slight deviation from radial)
        spread = (rand() - 0.5) * 0.4
        noise_seed = rand() * 1000.0
        debris.append({
            'angle': angle + spread,
            'speed': speed,
            'size': size,
            'temp': temp,
            'noise_seed': noise_seed,
            'trail_mult': 1.0 + rand() * 2.0,
        })
    return debris


def _make_smoke(seed, cfg):
    """Generate smoke particle properties."""
    rand = make_rand(seed + 9999)
    smoke = []
    for i in range(cfg['smoke_particle_count']):
        angle = rand() * math.pi * 2
        dist = rand() * 0.3
        size = 8 + rand() * 20
        drift_angle = rand() * math.pi * 2
        drift_speed = 0.02 + rand() * 0.05
        smoke.append({
            'angle': angle,
            'dist': dist,
            'size': size,
            'drift_angle': drift_angle,
            'drift_speed': drift_speed,
            'alpha': 0.3 + rand() * 0.4,
            'noise_seed': rand() * 1000.0,
        })
    return smoke


def render_frame(t, render_size, seed=123, cfg=None):
    """Render a single frame of explosion effect.

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

    cx = cy = render_size // 2
    scale = render_size / 800.0
    max_dist = render_size * 0.45

    img = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Time mapping for loop mode
    if cfg['timing'] == 'loop':
        bf = cfg['buildup_fraction']
        if t < bf:
            # Build-up phase: map to -1..0
            blast_t = -1.0 + t / bf
        else:
            # Explosion phase: map to 0..1
            blast_t = (t - bf) / (1.0 - bf)
    else:
        blast_t = t

    debris = _make_debris(seed, cfg)

    # ── Build-up phase (energy gathering before explosion) ──
    if blast_t < 0:
        buildup = 1.0 + blast_t  # 0 -> 1 during buildup
        # Converging particles
        for d in debris[:40]:
            # Particles move inward
            progress = buildup
            dist = max_dist * (1.0 - progress * 0.8)
            px = cx + math.cos(d['angle']) * dist
            py = cy + math.sin(d['angle']) * dist
            alpha = progress * 0.6
            sz = int(d['size'] * scale * 0.5)
            if alpha > 0.01 and sz >= 1:
                a = int(255 * alpha)
                c = (255, 240, 200, a)
                draw.ellipse([px - sz, py - sz, px + sz, py + sz], fill=c)

        # Growing center glow
        gr = int(15 * scale * buildup * buildup)
        draw_glow(draw, cx, cy, gr, (255, 250, 230, int(200 * buildup)), buildup)
        apply_circular_mask(img, cfg['mask_fade_start'], cfg['mask_fade_end'])
        return img

    # ── Explosion phase ──

    # Central flash
    if blast_t < cfg['flash_duration']:
        flash_t = blast_t / cfg['flash_duration']
        flash_r = int(render_size * cfg['flash_radius_max'] * ease_out_expo(flash_t))
        flash_alpha = 1.0 - ease_in_quad(flash_t)
        fc = cfg['flash_color']
        draw_glow(draw, cx, cy, flash_r, fc, flash_alpha)

    # Shockwave ring
    if cfg['shockwave'] and blast_t < cfg['shockwave_fade']:
        sw_t = blast_t / cfg['shockwave_fade']
        sw_radius = int(max_dist * cfg['shockwave_speed'] * ease_out_cubic(sw_t))
        sw_width = max(1, int(render_size * cfg['shockwave_width'] * (1.0 - sw_t * 0.7)))
        sw_alpha = int(200 * (1.0 - ease_in_quad(sw_t)))
        if sw_alpha > 0 and sw_radius > sw_width:
            ring_color = (255, 240, 220, sw_alpha)
            # Draw ring as two ellipses
            outer = sw_radius
            inner = max(0, sw_radius - sw_width)
            # Outer ellipse
            mask_ring = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
            dr = ImageDraw.Draw(mask_ring)
            dr.ellipse([cx - outer, cy - outer, cx + outer, cy + outer], fill=ring_color)
            dr.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=(0, 0, 0, 0))
            img = Image.alpha_composite(img, mask_ring)
            draw = ImageDraw.Draw(img)

    # Debris particles
    for d in debris:
        # Eased expansion
        exp_t = ease_out_cubic(min(1.0, blast_t * 1.2))
        dist = max_dist * d['speed'] * exp_t

        # Noise wobble
        wobble = noise3(d['noise_seed'], blast_t * 3, 0, seed=seed) * 0.15
        angle = d['angle'] + wobble

        px = cx + math.cos(angle) * dist
        py = cy + math.sin(angle) * dist

        # Fade
        if blast_t > cfg['debris_fade_start']:
            fade_t = (blast_t - cfg['debris_fade_start']) / (1.0 - cfg['debris_fade_start'])
            alpha = max(0.0, 1.0 - ease_in_quad(fade_t))
        else:
            alpha = 1.0

        if alpha < 0.01:
            continue

        # Color interpolation based on temperature and time
        temp = d['temp'] + blast_t * 0.4  # Gets cooler over time
        temp = min(1.0, temp)

        if temp < 0.4:
            ct = temp / 0.4
            hc = cfg['hot_color']
            wc = cfg['warm_color']
            color = tuple(int(hc[i] + (wc[i] - hc[i]) * ct) for i in range(4))
        else:
            ct = (temp - 0.4) / 0.6
            wc = cfg['warm_color']
            cc = cfg['cool_color']
            color = tuple(int(wc[i] + (cc[i] - wc[i]) * ct) for i in range(4))

        sz = max(1, int(d['size'] * scale * (1.0 - blast_t * 0.5)))

        # Trail
        trail_len = sz * cfg['debris_trail_length'] * d['trail_mult'] * (1.0 - blast_t * 0.5)
        if trail_len > 2:
            tx = px + math.cos(angle + math.pi) * trail_len
            ty = py + math.sin(angle + math.pi) * trail_len
            ta = int(color[3] * alpha * 0.4)
            if ta > 0:
                draw.line([(px, py), (tx, ty)],
                          fill=(color[0], color[1], color[2], ta),
                          width=max(1, sz))

        # Particle body
        pa = int(color[3] * alpha)
        if pa > 0:
            draw.ellipse([px - sz, py - sz, px + sz, py + sz],
                         fill=(color[0], color[1], color[2], pa))
            # Hot core
            cs = max(1, sz // 2)
            ca = int(255 * alpha * 0.8)
            draw.ellipse([px - cs, py - cs, px + cs, py + cs],
                         fill=(255, 255, 240, ca))

    # Smoke
    if cfg['smoke_enabled'] and blast_t > cfg['smoke_start']:
        smoke_particles = _make_smoke(seed, cfg)
        smoke_t = (blast_t - cfg['smoke_start']) / (1.0 - cfg['smoke_start'])
        smoke_alpha = min(1.0, smoke_t * 2) * (1.0 - max(0, smoke_t - 0.5) * 2)

        if smoke_alpha > 0.01:
            for sp in smoke_particles:
                s_dist = (sp['dist'] + smoke_t * cfg['smoke_expand_speed']) * max_dist
                s_angle = sp['angle'] + noise3(sp['noise_seed'], smoke_t * 2, 0, seed=seed + 500) * 0.3
                sx = cx + math.cos(s_angle) * s_dist
                sy = cy + math.sin(s_angle) * s_dist
                ss = int(sp['size'] * scale * (0.5 + smoke_t * 1.5))
                sa = int(cfg['smoke_color'][3] * sp['alpha'] * smoke_alpha)
                if sa > 1 and ss > 1:
                    sc = cfg['smoke_color']
                    draw.ellipse([sx - ss, sy - ss, sx + ss, sy + ss],
                                 fill=(sc[0], sc[1], sc[2], sa))

    # Soft blur
    img = img.filter(ImageFilter.GaussianBlur(radius=max(1, int(1.0 * scale))))

    apply_circular_mask(img, cfg['mask_fade_start'], cfg['mask_fade_end'])
    return img
