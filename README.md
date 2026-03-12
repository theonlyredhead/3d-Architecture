# COCO — Data Platform

Interactive 3D visualisation of COCO's DB-first data architecture. Built with Three.js — no build step, no dependencies beyond a browser.

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | HTML shell — structure and script/style references only |
| `style.css` | All styling, using CSS custom properties for easy theming |
| `data.js` | All connector and use-case data — **edit this to add/remove systems** |
| `app.js` | 3D scene, animation, interaction, and camera logic |

## Running locally

Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge). No server or build step required.

## Adding a connector

Edit `data.js`. Add an object to either `SOURCES` or `OUTPUTS`:

```js
{
  id:   'my-system',    // unique ID, no spaces
  name: 'My System',   // display name
  type: 'Category',    // short type label shown in the UI
  ent:  'Enterprise',  // entity: Development | Construction | BTR | Enterprise | Output
  hex:  '#60A5FA',     // node colour (hex)
  sync: 'nightly',     // realtime | hourly | nightly | manual
  w:    3,             // visual weight controlling node size (1–6)
  desc: 'One-paragraph description of this connector.',
  uc: [
    {
      t:   'Use Case Title',
      a:   'Audience / role',
      d:   'Detailed description of the use case.',
      ai:  'How the AI layer is applied.',
      imp: 'Business impact — one punchy sentence.',
    },
  ],
}
```

No other files need to change. Refresh the browser and the new node appears automatically.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Cycle through all nodes |
| `Enter` | Select the currently hovered node |
| `Escape` | Deselect node / close use-case modal |

## Configuration

All layout and animation constants live in the `CONFIG` object at the top of `app.js`. Key values:

| Key | Default | Description |
|-----|---------|-------------|
| `layout.srcX` | `-32` | X position of source column |
| `layout.outX` | `30` | X position of output column |
| `layout.srcSpacing` | `5.0` | Vertical gap between source nodes |
| `camera.defaultRadius` | `72` | Default orbit distance |
| `animation.orbitSpeed` | `0.0007` | Auto-orbit speed (rad/frame) |
| `particles.pulseCount` | `60` | Total travelling pulse particles |

## Theming

CSS custom properties are defined in `:root` at the top of `style.css`. Change colours there to retheme the entire visualisation:

```css
:root {
  --bg-base:      #060a12;  /* page background */
  --accent-blue:  #3B82F6;  /* primary accent (API node, links) */
  --accent-green: #10B981;  /* database node */
  --accent-orange:#FB923C;  /* AI engine node */
  --accent-pink:  #FB7185;  /* output connectors */
}
```
