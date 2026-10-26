# KFL Texture assets

Real surface scans from **ambientCG** (https://ambientcg.com), licensed **CC0 1.0 Universal** (public domain):
free for commercial use, no attribution required. Kept here for transparency.

| File | Source asset |
| --- | --- |
| `paper-fibre-a.jpg` | ambientCG Paper001 (Color map) |
| `paper-crease-b.jpg` | ambientCG Paper003 (Color map) |
| `concrete-light-a.jpg` | ambientCG Concrete034 (Color map) |
| `concrete-rough-b.jpg` | ambientCG Concrete035 (Color map) |
| `concrete-old-c.jpg` | ambientCG Concrete036 (Color map) |

Processing: converted to greyscale, large-scale lighting removed (high-pass), normalised to the same
strength around mid-grey (128), edges trimmed 3%. KFL applies them with a random rotation, flip,
scale and offset per photo (lib/kfl/textureEngine.ts), on luminance only, so colours are preserved.
Dust, scratches and grain are procedural (no assets).
