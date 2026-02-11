"""
Lightning / Electric Arc Effect
Generates animated lightning bolts with branching, glow, and flicker.
Uses midpoint displacement algorithm with noise-based animation.
"""

from PIL import Image, ImageDraw, ImageFilter
import math
from .common import (
    make_rand, apply_circular_mask, noise3, fbm,
    draw_glow, draw_line_glow
)

DEFAULT_CONFIG = {
    # Bolt structure
    'bolt_count': 3,             # Number of main lightning bolts
    'subdivisions': 6,           # Midpoint displacement iterations
    'displacement': 0.35,        # Base displacement factor (ratio of segment length)
    'branch_chance': 0.18,       # Probability of branching at each point
    'branch_length_ratio': 0.5,  # Branch length relative to remaining bolt
    'max_branch_depth': 2,       # Maximum recursion depth for branches

    # Animation
    'flicker_speed': 8.0,        # Flicker frequency
    'morph_speed': 2.0,          # How fast the bolt shape changes
    'bolt_lifetime': 0.4,        # Fraction of cycle each bolt is visible
    'bolt_stagger': True,        # Stagger bolt appearances

    # Appearance
    'core_width': 2.5,           # Width of bright core
    'glow_width': 8.0,           # Width of outer glow
    'core_color': (220, 235, 255, 255),
    'glow_color': (100, 140, 255, 180),
    'branch_color': (150, 180, 255, 160),

    # Center flash
    'center_flash': True,
    'flash_radius': 20,
    'flash_color': (200, 220, 255, 200),

    # Mask
    'mask_fade_start': 0.38,
    'mask_fade_end': 0.48,

    # Layout: 'radial' = bolts from edges to center, 'random' = random positions
    'layout': 'radial',
}


def _midpoint_displace(points, displacement, rand_fn, noise_t, seed_offset):
    """One iteration of midpoint displacement on a point list."""
    new_points = [points[0]]
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i + 1]
        mx = (p1[0] + p2[0]) / 2
        my = (p1[1] + p2[1]) / 2

        # Perpendicular direction
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        seg_len = math.sqrt(dx * dx + dy * dy)
        if seg_len < 0.01:
            new_points.append((mx, my))
            new_points.append(p2)
            continue

        # Perpendicular unit vector
        px = -dy / seg_len
        py = dx / seg_len

        # Noise-animated displacement
        n = noise3(mx * 0.01 + seed_offset, my * 0.01, noise_t, seed=int(seed_offset * 10) % 1000)
        offset = n * displacement * seg_len

        new_points.append((mx + px * offset, my + py * offset))
        new_points.append(p2)
    return new_points


def _generate_bolt(start, end, cfg, rand_fn, noise_t, seed_offset, depth=0):
    """Generate a lightning bolt path with optional branches."""
    points = [start, end]

    disp = cfg['displacement']
    for i in range(cfg['subdivisions']):
        points = _midpoint_displace(points, disp, rand_fn, noise_t, seed_offset + i * 7.3)
        disp *= 0.55  # Reduce displacement each iteration

    # Generate branches
    branches = []
    if depth < cfg['max_branch_depth']:
        for i in range(1, len(points) - 1):
            if rand_fn() < cfg['branch_chance']:
                bp = points[i]
                # Branch direction: roughly continuing from main bolt + random offset
                dx = points[i][0] - points[max(0, i - 1)][0]
                dy = points[i][1] - points[max(0, i - 1)][1]
                branch_angle = math.atan2(dy, dx) + (rand_fn() - 0.5) * 1.5
                remaining = math.sqrt(
                    (end[0] - bp[0]) ** 2 + (end[1] - bp[1]) ** 2
                )
                bl = remaining * cfg['branch_length_ratio']
                branch_end = (
                    bp[0] + math.cos(branch_angle) * bl,
                    bp[1] + math.sin(branch_angle) * bl
                )
                branch_points, _ = _generate_bolt(
                    bp, branch_end, cfg, rand_fn, noise_t,
                    seed_offset + i * 13.7, depth + 1
                )
                branches.append(branch_points)

    return points, branches


def _draw_bolt(draw, points, core_w, glow_w, core_color, glow_color, alpha=1.0):
    """Draw a lightning bolt from a point list."""
    if len(points) < 2 or alpha < 0.01:
        return

    # Draw glow layer first
    ga = int(glow_color[3] * alpha)
    if ga > 0:
        gc = (glow_color[0], glow_color[1], glow_color[2], ga)
        for i in range(len(points) - 1):
            x1, y1 = points[i]
            x2, y2 = points[i + 1]
            draw.line([(x1, y1), (x2, y2)], fill=gc, width=max(1, int(glow_w)))

    # Core
    ca = int(core_color[3] * alpha)
    if ca > 0:
        cc = (core_color[0], core_color[1], core_color[2], ca)
        for i in range(len(points) - 1):
            x1, y1 = points[i]
            x2, y2 = points[i + 1]
            draw.line([(x1, y1), (x2, y2)], fill=cc, width=max(1, int(core_w)))


def render_frame(t, render_size, seed=42, cfg=None):
    """Render a single frame of lightning effect.

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

    rand = make_rand(seed)
    cx = cy = render_size // 2
    scale = render_size / 800.0

    img = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    noise_t = t * cfg['morph_speed']

    # Flicker intensity
    flicker = 0.6 + 0.4 * abs(math.sin(t * math.pi * cfg['flicker_speed']))

    bolt_count = cfg['bolt_count']
    for bi in range(bolt_count):
        # Stagger bolt appearances
        if cfg['bolt_stagger']:
            bolt_phase = (t + bi / bolt_count) % 1.0
        else:
            bolt_phase = t

        # Bolt visibility window
        lt = cfg['bolt_lifetime']
        if bolt_phase > lt:
            # Bolt not visible in this part of the cycle
            bolt_alpha = 0.0
        else:
            # Fade in/out within lifetime
            inner_t = bolt_phase / lt
            if inner_t < 0.1:
                bolt_alpha = inner_t / 0.1
            elif inner_t > 0.7:
                bolt_alpha = (1.0 - inner_t) / 0.3
            else:
                bolt_alpha = 1.0

        if bolt_alpha < 0.01:
            continue

        bolt_alpha *= flicker

        # Bolt endpoints
        if cfg['layout'] == 'radial':
            angle = (bi / bolt_count) * math.pi * 2 + noise3(bi * 10.0, t * 2.0, 0, seed=seed) * 0.5
            edge_dist = render_size * 0.45
            start = (cx + math.cos(angle) * edge_dist, cy + math.sin(angle) * edge_dist)
            # End near center with slight offset
            end_offset = noise3(bi * 20.0, t * 3.0, 5.0, seed=seed) * 15 * scale
            end = (cx + end_offset, cy + noise3(bi * 20.0 + 50, t * 3.0, 5.0, seed=seed) * 15 * scale)
        else:
            x1 = rand() * render_size
            y1 = rand() * render_size
            x2 = rand() * render_size
            y2 = rand() * render_size
            start = (x1, y1)
            end = (x2, y2)

        # Generate bolt
        bolt_seed_offset = bi * 100.0
        points, branches = _generate_bolt(
            start, end, cfg, rand, noise_t, bolt_seed_offset
        )

        # Draw branches first (behind)
        bc = cfg['branch_color']
        for branch_pts in branches:
            _draw_bolt(draw, branch_pts,
                       cfg['core_width'] * scale * 0.6,
                       cfg['glow_width'] * scale * 0.5,
                       bc, (bc[0], bc[1], bc[2], int(bc[3] * 0.6)),
                       bolt_alpha * 0.7)

        # Draw main bolt
        _draw_bolt(draw, points,
                   cfg['core_width'] * scale,
                   cfg['glow_width'] * scale,
                   cfg['core_color'], cfg['glow_color'],
                   bolt_alpha)

    # Center flash
    if cfg['center_flash']:
        flash_intensity = 0.3 + 0.7 * abs(math.sin(t * math.pi * cfg['flicker_speed'] * 1.5))
        fr = int(cfg['flash_radius'] * scale)
        fc = cfg['flash_color']
        draw_glow(draw, cx, cy, fr, fc, flash_intensity)

    # Blur for softer glow
    img = img.filter(ImageFilter.GaussianBlur(radius=max(1, int(1.5 * scale))))

    apply_circular_mask(img, cfg['mask_fade_start'], cfg['mask_fade_end'])
    return img
