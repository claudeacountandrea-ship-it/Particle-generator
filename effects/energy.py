"""
Energy Accumulation Effect - Improved version
Particles converge toward center in a perfect loop.
Uses simplex noise for organic wobble and variable brightness.
"""

from PIL import Image, ImageDraw, ImageChops
import math
from .common import (
    make_rand, apply_circular_mask, noise3, fbm,
    ease_power, draw_glow, lerp_color
)

# ── Default config ─────────────────────────────────────────────────────

DEFAULT_CONFIG = {
    'path_count': 180,
    'particles_per_path': 2,
    'max_dist_ratio': 0.625,

    # Trapezoid shape
    'base_w_min': 4,
    'base_w_max': 14,
    'length_mult_min': 2.5,
    'length_mult_max': 4.0,
    'head_shrink': 0.25,

    # Motion
    'ease_power': 2.0,
    'noise_wobble': 0.06,       # Noise-based angular wobble strength
    'noise_speed_var': 0.15,    # Noise-based speed variation

    # Alpha
    'fade_in': 0.04,
    'fade_out_start': 0.88,

    # Mask
    'mask_fade_start': 0.35,
    'mask_fade_end': 0.50,

    # Core
    'core_pulse_freq': 2,
    'core_radius': 5,
    'core_pulse_amp': 3,
    'core_glow_radius': 25,

    # Color mode: 'white', 'blue', 'warm'
    'color_mode': 'white',
}


# ── Color palettes ─────────────────────────────────────────────────────

COLOR_PALETTES = {
    'white': {
        'body': lambda b, dr: (b, b, min(255, b + 10)),
        'head': (255, 255, 255),
        'core': (255, 255, 255),
        'core_glow': (220, 235, 255),
    },
    'blue': {
        'body': lambda b, dr: (int(b * 0.6), int(b * 0.8), min(255, b + 30)),
        'head': (200, 220, 255),
        'core': (180, 210, 255),
        'core_glow': (100, 150, 255),
    },
    'warm': {
        'body': lambda b, dr: (min(255, b + 20), int(b * 0.8), int(b * 0.3)),
        'head': (255, 240, 200),
        'core': (255, 230, 180),
        'core_glow': (255, 180, 80),
    },
}


def make_particles(seed_val, phase_offset=0.0, cfg=None):
    """Create particle list with fixed properties."""
    if cfg is None:
        cfg = DEFAULT_CONFIG
    rand = make_rand(seed_val)
    particles = []
    pc = cfg['path_count']
    ppp = cfg['particles_per_path']

    for path in range(pc):
        angle = rand() * math.pi * 2
        for j in range(ppp):
            phase = (path * ppp + j) / (pc * ppp)
            phase_jitter = rand() * 0.005
            bright = 205 + int(rand() * 50)
            length_mult = cfg['length_mult_min'] + rand() * (cfg['length_mult_max'] - cfg['length_mult_min'])
            # Noise seed per particle for wobble variation
            noise_seed = rand() * 1000.0
            particles.append({
                'angle': angle,
                'phase': (phase + phase_jitter + phase_offset) % 1.0,
                'bright': bright,
                'length_mult': length_mult,
                'noise_seed': noise_seed,
            })
    return particles


def _get_state(p, t, cx, cy, max_dist, scale, cfg):
    """Compute particle position and shape at time t (0..1)."""
    progress = (t + p['phase']) % 1.0

    # Noise-based speed variation for organic feel
    speed_noise = noise3(
        p['noise_seed'], t * 3.0, 0.0, seed=42
    ) * cfg['noise_speed_var']
    effective_progress = max(0.0, min(1.0, progress + speed_noise * progress))

    # Ease toward center
    eased = ease_power(effective_progress, cfg['ease_power'])

    # Distance from center
    dist = max_dist * (1.0 - eased)
    if dist < 2:
        dist = 2

    # Angular wobble using noise (organic, not jittery)
    wobble = noise3(
        p['noise_seed'] + 100, t * 4.0, progress * 2.0, seed=77
    ) * cfg['noise_wobble'] * (1.0 - progress)  # Less wobble near center

    angle = p['angle'] + wobble

    x = cx + math.cos(angle) * dist
    y = cy + math.sin(angle) * dist
    dist_ratio = dist / max_dist

    # Trapezoid size
    base_w = (cfg['base_w_min'] + dist_ratio * cfg['base_w_max']) * scale
    length = base_w * p['length_mult']
    head_w = base_w * (cfg['head_shrink'] + dist_ratio * 0.15)
    tail_w = base_w

    # Alpha with smooth fade
    alpha = 1.0
    if progress < cfg['fade_in']:
        alpha = progress / cfg['fade_in']
    elif progress > cfg['fade_out_start']:
        alpha = (1.0 - progress) / (1.0 - cfg['fade_out_start'])
    alpha = max(0.0, min(1.0, alpha))

    return {
        'x': x, 'y': y, 'angle': angle,
        'length': length, 'head_w': head_w, 'tail_w': tail_w,
        'alpha': alpha, 'dist': dist, 'dist_ratio': dist_ratio,
    }


def _draw_trapezoid(draw, p, s, palette):
    """Draw elongated trapezoid (narrow head -> wide tail)."""
    a = s['alpha']
    if a < 0.01:
        return

    b = p['bright']
    angle = s['angle']
    hH = s['head_w'] / 2
    tH = s['tail_w'] / 2
    ln = s['length']
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)

    def to_world(lx, ly):
        return (s['x'] + lx * cos_a - ly * sin_a,
                s['y'] + lx * sin_a + ly * cos_a)

    # Body color from palette
    bc = palette['body'](b, s['dist_ratio'])

    # Main body
    p0 = to_world(0, -hH)
    p1 = to_world(ln, -tH)
    p2 = to_world(ln, tH)
    p3 = to_world(0, hH)
    ia = int(255 * a * 0.7)
    draw.polygon([p0, p1, p2, p3], fill=(bc[0], bc[1], bc[2], ia))

    # Bright head
    hl = ln * 0.2
    hH2 = hH * 0.6
    tH2 = hH + (tH - hH) * 0.2
    hp0 = to_world(0, -hH2 * 0.9)
    hp1 = to_world(hl, -tH2 * 0.8)
    hp2 = to_world(hl, tH2 * 0.8)
    hp3 = to_world(0, hH2 * 0.9)
    hc = palette['head']
    draw.polygon([hp0, hp1, hp2, hp3], fill=(hc[0], hc[1], hc[2], int(255 * a * 0.9)))


def _draw_core(draw, t, cx, cy, scale, cfg, palette):
    """Draw pulsing core glow at center."""
    pulse = 0.5 + 0.5 * math.sin(t * math.pi * 2 * cfg['core_pulse_freq'])
    cr = int((cfg['core_radius'] + pulse * cfg['core_pulse_amp']) * scale)
    glow_r = int(cfg['core_glow_radius'] * scale)

    gc = palette['core_glow']
    cc = palette['core']

    for r in range(cr + glow_r, 0, -1):
        if r > cr:
            frac = (r - cr) / glow_r
            v_frac = (1 - frac) * 0.3
            aa = int(255 * (1 - frac) * 0.25)
        else:
            frac = r / max(1, cr)
            v_frac = 0.78 + 0.22 * (1 - frac)
            aa = int(230 * (1 - frac * 0.3))
        if aa < 1:
            continue
        if r > cr:
            c = (int(gc[0] * v_frac), int(gc[1] * v_frac), int(gc[2] * v_frac), aa)
        else:
            c = (int(cc[0] * v_frac), int(cc[1] * v_frac), min(255, int(cc[2] * v_frac) + 8), aa)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)


def render_frame(t, render_size, particles=None, seed=77, phase_offset=0.0,
                 rotation_deg=0, cfg=None):
    """Render a single frame of the energy accumulation effect.

    Args:
        t: Time in range [0, 1) for one full loop cycle.
        render_size: Pixel size of the output frame (square).
        particles: Pre-built particle list, or None to auto-create.
        seed: Random seed for particle generation.
        phase_offset: Phase offset for variant generation.
        rotation_deg: Final rotation in degrees.
        cfg: Config dict (uses DEFAULT_CONFIG if None).

    Returns:
        PIL.Image (RGBA) of size render_size x render_size.
    """
    if cfg is None:
        cfg = DEFAULT_CONFIG

    palette = COLOR_PALETTES.get(cfg.get('color_mode', 'white'), COLOR_PALETTES['white'])

    if particles is None:
        particles = make_particles(seed, phase_offset, cfg)

    cx = cy = render_size // 2
    max_dist = render_size * cfg['max_dist_ratio']
    scale = render_size / 800.0

    img = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Sort particles far-first (painter's order)
    sorted_p = []
    for p in particles:
        s = _get_state(p, t, cx, cy, max_dist, scale, cfg)
        if s['alpha'] < 0.01:
            continue
        sorted_p.append((s['dist'], p, s))
    sorted_p.sort(key=lambda x: -x[0])

    for dist, p, s in sorted_p:
        _draw_trapezoid(draw, p, s, palette)

    _draw_core(draw, t, cx, cy, scale, cfg, palette)

    # Apply circular mask
    apply_circular_mask(img, cfg['mask_fade_start'], cfg['mask_fade_end'])

    # Rotate if needed
    if rotation_deg != 0:
        img = img.rotate(-rotation_deg, resample=Image.BICUBIC, center=(cx, cy))

    return img
