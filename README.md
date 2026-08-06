# Projects portfolio

A dependency-free, static portfolio of the projects in the parent workspace.

## Publish with GitHub Pages

1. Create a new GitHub repository (for example, `projects`).
2. Copy this folder’s contents into it and push the `main` branch.
3. In GitHub, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.

The included workflow deploys the static site after each push to `main`.

## Maintaining projects

Edit `projects.js` to add, remove, or update cards. A `github` field is deliberately present only for verified public repositories. Do not add private repository URLs; omit the field instead.
