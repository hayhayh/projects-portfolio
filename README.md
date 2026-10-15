# Projects portfolio

A dependency-free, static portfolio of the projects in the parent workspace.

## Publish with GitHub Pages

1. Create a new GitHub repository (for example, `projects`).
2. Copy this folder’s contents into it and push the `main` branch.
3. In GitHub, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.

The included workflow deploys the static site after each push to `main`.

## Maintaining projects

Edit `projects.js` to add, remove, or update entries. A `github` field is deliberately present only for verified public repositories. Do not add private repository URLs; omit the field instead.

## Interactive map

`world/` is an alternative, game-like view ("Hayville"): categories are districts, projects are buildings you can walk to. It reads the same `projects.js`, so adding a project updates both views. The plain list at `/` links to it, and it links back.
