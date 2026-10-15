# Projects portfolio

A dependency-free, static portfolio of the projects in the parent workspace.

## Publish with GitHub Pages

1. Create a new GitHub repository (for example, `projects`).
2. Copy this folder’s contents into it and push the `main` branch.
3. In GitHub, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.

The included workflow deploys the static site after each push to `main`.

## Maintaining projects

Edit `projects.js` to add, remove, or update entries. A `github` field is deliberately present only for verified public repositories. Do not add private repository URLs; omit the field instead.

## Interactive town

`town/` is a game-like alternative view ("Hayville"): an isometric, pixel-style 3D town built with Three.js (vendored in `town/vendor/`, no build step). Categories are streets, projects are buildings you can walk into. Everything is generated procedurally, with no image or model assets, and it reads the same `projects.js` as the plain list, so adding a project updates both. The plain list at `/` links to it, and it links back; it also falls back to the plain list when WebGL isn't available.

Run locally with `python3 -m http.server` and open `/town/`.
