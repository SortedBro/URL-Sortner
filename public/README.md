# Frontend Asset Structure

This folder now uses a production-oriented layout:

- `css/pages/`  
  Page-level styles (`home.css`, `dashboard.css`, etc.)
- `css/components/`  
  Reusable component styles (`footer.css`)
- `js/pages/`  
  Page-level JavaScript (`tools.js`, etc.)
- `js/shared/`  
  Shared frontend utilities (`theme.js`)

## Backward compatibility

Legacy files are still available in the old locations:

- `css/*.css` wrapper files now import canonical styles from `css/pages/*` or `css/components/*`.
- Existing `public/script/*` files are kept, while canonical copies now exist in `public/js/pages/*`.

Use canonical paths in new code:

- CSS: `/css/pages/<page>.css`
- Shared JS: `/js/shared/<file>.js`
- Page JS: `/js/pages/<page>.js`
