# Rifle Lake Atlas v5 — Phase 1 remote build

This build retains the user's full contour chart and adds a hybrid comparison workflow against satellite imagery and Michigan's official inland-lake contour service.

## Added in v5
- Hybrid, user-map, state-contour and satellite layer presets
- State-contour browser cache after the first successful online load
- Source-disagreement comparison mode
- Tap-to-read coordinates and nearest loaded state contour
- Weather-ranked "Today's best areas"
- Wind status on the map
- Locked/unlocked calibration handles and saved geographic bounds
- Correct GPS accuracy conversion and follow mode

## Deployment
GPS and service-worker behavior require HTTPS. Upload the contents of this folder to GitHub Pages, Netlify, Cloudflare Pages, or another HTTPS static host.

## Accuracy
The map overlay is remotely calibrated from published geographic extent and must still be validated against recognizable shoreline control points and then checked on the water. This is a fishing aid, not a navigation chart.
