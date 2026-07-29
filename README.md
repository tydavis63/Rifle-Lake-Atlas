# Rifle Lake Fishing Atlas 2.0

GPS-first mobile fishing map for Rifle Lake, Ogemaw County, Michigan.

## Map architecture

- OpenStreetMap and Esri satellite basemaps
- Michigan Inland Lake Contours queried as coordinate-based vector features
- Depth labels generated from the official `DEPTH` attribute
- High-accuracy browser GPS with accuracy circle
- Raster contour fallback if the vector query is unavailable

The third-party fishing-app screenshot is **not** included or redistributed.

## GitHub Pages

Upload the contents of this folder to the repository root. GitHub Pages should deploy from the `main` branch and `/(root)` folder.
