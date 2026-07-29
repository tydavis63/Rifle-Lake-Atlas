# Rifle Lake Atlas v8

Focused fishing-companion update:

- Your supplied contour chart is now the primary map.
- Michigan vector contours are hidden in a developer-only comparison section.
- Permanent numbered spots were removed.
- Three live recommendations now appear as START, NEXT and BACKUP.
- A Today's Game Plan card shows target area, depth and lure sequence.
- No catch log.

## GitHub Pages update
Upload the contents of this folder into the same GitHub folder that currently contains v5, replacing files with the same names. Commit the changes. The installed Home Screen app will update after it is reopened; iOS may briefly show the cached version, so close/reopen it or refresh the Safari page once.


## v8 map alignment update
The default contour overlay was reduced and repositioned to better match the OpenStreetMap shoreline. v8 uses a new calibration storage key, so older oversized saved bounds do not carry forward. This is a remote first-pass alignment and still requires onsite GPS validation before being relied upon for precise navigation.


## v12 contour alignment fix
The official ArcGIS contour export now uses an image aspect ratio calculated from the requested Web Mercator extent. This prevents the ArcGIS service from silently expanding or cropping the requested extent and keeps the contour raster aligned with Leaflet, OpenStreetMap, satellite imagery, and the GPS dot.


## v12 depth chart improvements
- Loads the official contour features with their DEPTH attributes.
- Labels contour lines in feet at readable intervals.
- Uses heavier styling for 10-foot index contours.
- Tapping the map reports the nearest official contour depth and distance.
- Falls back to the GPS-aligned raster contours if the feature query is temporarily unavailable.
