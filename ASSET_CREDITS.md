# Asset credits and provenance

The Last Hearth is an unofficial, non-canonical Lord of the Rings / Middle-earth fan-game concept. Franchise and recognisable lore names remain the property of their respective rightsholders. No endorsement is implied. This project does not claim a licence to the underlying franchise. The traveller, valley, Ashen Regent, other new named bosses, lesser rings, dialogue, layouts and original ending prose were authored for this project.

## Original visual assets

The source illustrations were created for this project with OpenAI image generation and prepared locally into a consistent Phaser texture atlas. Source files and generation notes are included in `assets-source/`:

| Source | Runtime output | Use |
|---|---|---|
| `last-hearth-title-backdrop.png` | `title.webp` | Future stronghold at dusk |
| `last-hearth-prop-atlas-magenta.png` | `world-atlas.png/json` | Twelve scenery/settlement props |
| `last-hearth-character-atlas-magenta.png` | `world-atlas.png/json` | Traveller and eight creature families |
| `last-hearth-ground-material-atlas.png` | Four `ground-*.webp` files | Forest, earth, stone and snow materials |

Preparation removed the flat magenta staging background, cropped connected components, rescaled and packed 21 individual images into a 2048×768 texture atlas. This atlas is **not a frame-by-frame animation sheet**. Runtime animation uses pose transforms, direction flips, weapon overlays, telegraph anticipation, hit flashes and death fading. No actor likeness, film frame or asset extracted from another game was used.

`src/ui/icons.ts` contains twelve original SVG ring glyphs. Telegraph geometry, particles, minimap, inventory export layout, weapon overlays and seasonal footprints are drawn by code. Typography uses Georgia/Times and the device's system sans-serif fonts; no downloaded proprietary font is bundled.

## Original audio

`scripts/make-audio.py` synthesises all seventeen included WAV files from mathematical waveforms, envelopes and seeded noise. These cover footsteps, sword/bow sounds, impacts, dodge, rings, flask, coins/loot, boss/telegraph cues, parry, breaking objects, victory, a restrained musical loop and ambience. No recording, sample library, movie score or existing game's audio is included. Audio has not undergone a dedicated listening pass on physical phone speakers or headphones; all gameplay cues also have visible equivalents.

## Dependencies

- Phaser 3.90.0: MIT, copyright Richard Davey / Photon Storm and contributors. Bundled licence in `licenses/Phaser-MIT.md`. Official source: https://github.com/phaserjs/phaser.
- Vite 6.3.5: MIT; `licenses/Vite-MIT.md` includes its notices.
- TypeScript 5.7.3: Apache-2.0; `licenses/TypeScript.txt` and third-party notices included.
- tsx 4.19.4 and `@types/node` are development dependencies locked by npm; npm package licences remain authoritative.

The game makes no runtime calls to paid APIs or generative services. The generated artwork is already included as local files. Replacing franchise references and content is supported through `src/content/`; rebranding must also update visible titles and fan attribution.
