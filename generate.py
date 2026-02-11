#!/usr/bin/env python3
"""
=== PARTICLE VFX SPRITESHEET GENERATOR ===
Multi-effect spritesheet generator for Roblox ParticleEmitter flipbooks.

Supports: energy, lightning, explosion, fire
Output: PNG spritesheets ready for Roblox custom flipbook layouts.

Usage:
  python generate.py                          # Generate all effects
  python generate.py --effect energy          # Single effect
  python generate.py --effect lightning --grid 8 --size 4096
  python generate.py --effect explosion --variants 2
  python generate.py --list                   # Show available effects

Roblox Setup:
  FlipbookLayout = Custom
  FlipbookSizeX = GRID
  FlipbookSizeY = GRID
  FlipbookMode = Loop
  FlipbookFramerate = 16-30 (adjust to taste)
"""

import argparse
import os
import sys
import time
from PIL import Image

# ── Effect registry ────────────────────────────────────────────────────

EFFECTS = {}

def _register_effects():
    """Import and register all effect modules."""
    from effects import energy, lightning, explosion, fire

    EFFECTS['energy'] = {
        'module': energy,
        'description': 'Energy accumulation - particles converge to center (loop)',
        'default_seed': 77,
        'supports_variants': True,
        'variant_b_phase': 0.37,
        'variant_b_rotation': 46,
    }
    EFFECTS['lightning'] = {
        'module': lightning,
        'description': 'Lightning bolts with branching and flicker (loop)',
        'default_seed': 42,
        'supports_variants': True,
        'variant_b_phase': 0.0,
        'variant_b_rotation': 90,
    }
    EFFECTS['explosion'] = {
        'module': explosion,
        'description': 'Expanding burst with debris, shockwave, and smoke (loop/oneshot)',
        'default_seed': 123,
        'supports_variants': True,
        'variant_b_phase': 0.0,
        'variant_b_rotation': 30,
    }
    EFFECTS['fire'] = {
        'module': fire,
        'description': 'Procedural fire with embers and noise distortion (loop)',
        'default_seed': 55,
        'supports_variants': True,
        'variant_b_phase': 0.0,
        'variant_b_rotation': 0,
    }

_register_effects()


# ── Spritesheet assembly ──────────────────────────────────────────────

def generate_spritesheet(effect_name, sheet_size=4096, grid=8, render_mult=2,
                         seed=None, phase_offset=0.0, rotation_deg=0,
                         label='A', output_dir='.', cfg_overrides=None):
    """Generate a complete spritesheet for a given effect.

    Args:
        effect_name: Key in EFFECTS dict.
        sheet_size: Final spritesheet pixel size (square).
        grid: Grid dimensions (grid x grid frames).
        render_mult: Supersampling factor.
        seed: Random seed (None = use effect default).
        phase_offset: Phase offset for variant generation.
        rotation_deg: Final rotation in degrees.
        label: Label string for filename.
        output_dir: Output directory.
        cfg_overrides: Dict of config overrides.

    Returns:
        Path to saved PNG file.
    """
    effect = EFFECTS[effect_name]
    module = effect['module']
    if seed is None:
        seed = effect['default_seed']

    total_frames = grid * grid
    cell_size = sheet_size // grid
    render_size = cell_size * render_mult

    # Merge config overrides
    cfg = dict(module.DEFAULT_CONFIG)
    if cfg_overrides:
        cfg.update(cfg_overrides)

    print(f"\n{'=' * 55}")
    print(f"  Effect: {effect_name} ({effect['description'][:50]})")
    print(f"  Label: {label} | Seed: {seed}")
    print(f"  Sheet: {sheet_size}x{sheet_size} | Grid: {grid}x{grid} = {total_frames} frames")
    print(f"  Cell: {cell_size}x{cell_size}px | Render: {render_size}x{render_size}px (x{render_mult})")
    if rotation_deg:
        print(f"  Rotation: {rotation_deg} deg")
    print(f"{'=' * 55}")

    sheet = Image.new('RGBA', (sheet_size, sheet_size), (0, 0, 0, 0))

    # Pre-build particles for energy effect (shared across frames)
    extra_kwargs = {}
    if effect_name == 'energy':
        particles = module.make_particles(seed, phase_offset, cfg)
        extra_kwargs['particles'] = particles
        extra_kwargs['seed'] = seed
        extra_kwargs['phase_offset'] = phase_offset
        extra_kwargs['rotation_deg'] = rotation_deg
        extra_kwargs['cfg'] = cfg
    else:
        extra_kwargs['seed'] = seed
        extra_kwargs['cfg'] = cfg

    start_time = time.time()
    for i in range(total_frames):
        t = i / total_frames

        if effect_name == 'energy':
            frame = module.render_frame(t, render_size, **extra_kwargs)
        else:
            frame = module.render_frame(t, render_size, **extra_kwargs)
            if rotation_deg != 0:
                frame = frame.rotate(-rotation_deg, resample=Image.BICUBIC,
                                     center=(render_size // 2, render_size // 2))

        # Downsample
        if render_mult > 1:
            frame = frame.resize((cell_size, cell_size), Image.LANCZOS)

        col = i % grid
        row = i // grid
        sheet.paste(frame, (col * cell_size, row * cell_size))

        if (i + 1) % 8 == 0:
            elapsed = time.time() - start_time
            eta = elapsed / (i + 1) * (total_frames - i - 1)
            print(f"  [{i + 1:3d}/{total_frames}] {elapsed:.1f}s elapsed, ETA {eta:.1f}s")

    filename = f"spritesheet_{effect_name}_{label}_{sheet_size}x{sheet_size}.png"
    out_path = os.path.join(output_dir, filename)
    sheet.save(out_path, optimize=True)

    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    total_time = time.time() - start_time
    print(f"\n  -> Saved: {out_path}")
    print(f"  -> Size: {size_mb:.1f} MB | Time: {total_time:.1f}s")

    return out_path


# ── CLI ────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description='VFX Spritesheet Generator for Roblox',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Effects:
  energy     Particles converge to center (energy accumulation loop)
  lightning  Electric arcs with branching and flicker
  explosion  Expanding burst with debris, shockwave, smoke
  fire       Procedural fire with embers and noise

Examples:
  python generate.py                              # All effects, default settings
  python generate.py --effect energy              # Energy only
  python generate.py --effect lightning --grid 4   # 4x4 grid (16 frames)
  python generate.py --effect explosion --size 2048 --variants 2
  python generate.py --list
        """
    )
    parser.add_argument('--effect', '-e', choices=list(EFFECTS.keys()),
                        help='Effect to generate (default: all)')
    parser.add_argument('--size', '-s', type=int, default=4096,
                        help='Spritesheet size in pixels (default: 4096)')
    parser.add_argument('--grid', '-g', type=int, default=8,
                        help='Grid size NxN (default: 8 = 64 frames)')
    parser.add_argument('--render-mult', '-r', type=int, default=2,
                        help='Render multiplier for supersampling (default: 2)')
    parser.add_argument('--seed', type=int, default=None,
                        help='Random seed (default: per-effect)')
    parser.add_argument('--variants', '-v', type=int, default=1,
                        help='Number of variants to generate (default: 1)')
    parser.add_argument('--output', '-o', type=str, default='.',
                        help='Output directory (default: current)')
    parser.add_argument('--color', '-c', type=str, default=None,
                        choices=['white', 'blue', 'warm'],
                        help='Color mode for energy effect')
    parser.add_argument('--list', '-l', action='store_true',
                        help='List available effects')
    return parser.parse_args()


def main():
    args = parse_args()

    if args.list:
        print("\n=== Available Effects ===\n")
        for name, info in EFFECTS.items():
            print(f"  {name:12s}  {info['description']}")
        print()
        return

    # Ensure output directory exists
    os.makedirs(args.output, exist_ok=True)

    # Which effects to generate
    if args.effect:
        effect_names = [args.effect]
    else:
        effect_names = list(EFFECTS.keys())

    print("=== VFX SPRITESHEET GENERATOR ===")
    print(f"Effects: {', '.join(effect_names)}")
    print(f"Sheet: {args.size}x{args.size} | Grid: {args.grid}x{args.grid} = {args.grid ** 2} frames")
    print(f"Variants per effect: {args.variants}")

    all_paths = []

    for effect_name in effect_names:
        effect = EFFECTS[effect_name]
        seed = args.seed if args.seed is not None else effect['default_seed']

        cfg_overrides = {}
        if args.color and effect_name == 'energy':
            cfg_overrides['color_mode'] = args.color

        # Variant A
        path = generate_spritesheet(
            effect_name, args.size, args.grid, args.render_mult,
            seed=seed, label='A', output_dir=args.output,
            cfg_overrides=cfg_overrides if cfg_overrides else None
        )
        all_paths.append(path)

        # Additional variants
        for vi in range(1, args.variants):
            label = chr(ord('A') + vi)
            phase = effect.get('variant_b_phase', 0.0)
            rotation = effect.get('variant_b_rotation', 0)

            path = generate_spritesheet(
                effect_name, args.size, args.grid, args.render_mult,
                seed=seed, phase_offset=phase, rotation_deg=rotation,
                label=label, output_dir=args.output,
                cfg_overrides=cfg_overrides if cfg_overrides else None
            )
            all_paths.append(path)

    print(f"\n{'=' * 55}")
    print("=== DONE ===")
    print(f"\nGenerated {len(all_paths)} spritesheet(s):")
    for p in all_paths:
        print(f"  {p}")

    print(f"\nRoblox ParticleEmitter setup:")
    print(f"  FlipbookLayout = Custom")
    print(f"  FlipbookSizeX  = {args.grid}")
    print(f"  FlipbookSizeY  = {args.grid}")
    print(f"  FlipbookMode   = Loop")
    print(f"  FlipbookFramerate = 16-30 (adjust to taste)")


if __name__ == '__main__':
    main()
