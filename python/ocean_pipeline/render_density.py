"""Render a cited Mediterranean loggerhead model as a geographic PNG overlay.

Run explicitly after reviewing the source. This uses the published EMODnet
reprojection of Sparks & DiMatteo's long-term (2003–2018) density model.
The source variable is named 'abundance' and does not specify units, so the
map conveys relative values rather than inventing animals per square km.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path

SOURCE_SHA256 = "a9b968c24ab2f311d5ecbd820785397b9c3171796bbb3f85e5192198e5748cb5"
SOURCE_URL = "https://erddap.emodnet.eu/erddap/info/biology_8514_94a0_0784_7406/index.html"
MODEL_URL = "https://seamap.env.duke.edu/models/NUWC/Med/"
DOI_URL = "https://doi.org/10.3389/fmars.2022.930412"
BOUNDS = [-6.5, 30.0, 37.0, 46.0]  # west south east north, WGS84
WIDTH, HEIGHT = 1200, 560


def render(source: Path, image_path: Path, manifest_path: Path) -> dict:
    # Dependencies belong to the explicit model-refresh command, not the web app.
    import netCDF4
    import numpy as np
    from PIL import Image
    from pyproj import Transformer

    content = gzip.decompress(source.read_bytes()) if source.suffix == ".gz" else source.read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    if digest != SOURCE_SHA256:
        raise ValueError("Model file differs from the reviewed EMODnet snapshot")

    import tempfile
    with tempfile.TemporaryDirectory() as directory:
        nc_path = Path(directory) / "model.nc"
        nc_path.write_bytes(content)
        with netCDF4.Dataset(nc_path) as dataset:
            x = np.asarray(dataset.variables["x"][:], dtype=float)
            y = np.asarray(dataset.variables["y"][:], dtype=float)
            variable = dataset.variables["abundance"]
            if variable.dimensions != ("y", "x") or x.size != 380 or y.size != 166:
                raise ValueError("Unexpected EMODnet grid or variable dimensions")
            if getattr(variable, "units", None):
                raise ValueError("Source units changed; review legend and method")
            values = np.ma.filled(variable[:], np.nan).astype(float)
            cv = np.ma.filled(dataset.variables["coefficient_of_variation"][:], np.nan).astype(float)

    if not (np.allclose(np.diff(x), 10000) and np.allclose(np.diff(y), 10000)):
        raise ValueError("Unexpected source grid spacing")
    valid_source = values[np.isfinite(values) & (values > 0)]
    if valid_source.size < 1000:
        raise ValueError("Model grid has too few valid cells")
    p10, p50, p90 = [float(n) for n in np.percentile(valid_source, (10, 50, 90))]

    # Inverse lookup into the source EPSG:3035 grid for each WGS84 pixel.
    west, south, east, north = BOUNDS
    lon = west + (np.arange(WIDTH) + .5) / WIDTH * (east - west)
    lat = north - (np.arange(HEIGHT) + .5) / HEIGHT * (north - south)
    xx, yy = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True).transform(
        *np.meshgrid(lon, lat))
    col = np.rint((xx - x[0]) / 10000).astype(int)
    row = np.rint((yy - y[0]) / 10000).astype(int)
    inside = (col >= 0) & (col < x.size) & (row >= 0) & (row < y.size)
    sample = np.full((HEIGHT, WIDTH), np.nan)
    sample[inside] = values[row[inside], col[inside]]
    shown = np.isfinite(sample) & (sample > 0)
    if shown.sum() < 10000:
        raise ValueError("Map extent contains too little modeled area")

    # Transparent = model has no estimate. The gradient indicates relative
    # model values only; it does not claim an ecological occupancy threshold.
    intensity = np.zeros((HEIGHT, WIDTH))
    intensity[shown] = np.clip((np.log(sample[shown]) - np.log(p10)) /
                               (np.log(p90) - np.log(p10)), 0, 1)
    stops = np.array([[19, 86, 132], [37, 184, 180], [246, 214, 124]])
    color = np.empty((HEIGHT, WIDTH, 4), dtype=np.uint8)
    midpoint = intensity < .5
    for channel in range(3):
        color[:, :, channel] = np.where(midpoint,
            stops[0, channel] + intensity * 2 * (stops[1, channel] - stops[0, channel]),
            stops[1, channel] + (intensity - .5) * 2 * (stops[2, channel] - stops[1, channel]))
    color[:, :, 3] = np.where(shown, 172 + 47 * intensity, 0).astype(np.uint8)
    image_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(color, "RGBA").save(image_path, optimize=True)

    overlapping_cv = cv[np.isfinite(values) & np.isfinite(cv)]
    manifest = {
        "schemaVersion": 1,
        "scientificName": "Caretta caretta",
        "labelEs": "Abundancia relativa modelada · Mediterráneo",
        "period": "Promedio anual 2003–2018",
        "boundsWgs84": BOUNDS,
        "imageSize": [WIDTH, HEIGHT],
        "source": {
            "name": "Sparks y DiMatteo / NUWC, distribuido por EMODnet Biology",
            "url": SOURCE_URL, "modelUrl": MODEL_URL, "publicationUrl": DOI_URL,
            "citation": "Sparks, L. M. y DiMatteo, A. D. (2020). Loggerhead Sea Turtle Density in the Mediterranean Sea; DiMatteo et al. (2022), Frontiers in Marine Science.",
            "rights": "Distribution Statement A: Approved for public release; distribution unlimited (metadatos EMODnet)",
            "sourceSha256": digest,
            "note": "EMODnet reprojected the original model to a 10 km EPSG:3035 grid; its metadata cautions about unassessed positional and value discrepancies.",
        },
        "rendering": {
            "method": "Nearest native EPSG:3035 model cell reprojected to WGS84; positive valid cells shaded with a log scale between source p10 and p90; nodata transparent.",
            "variable": "abundance", "units": "unspecified by source; relative values only",
            "modelCells": int(valid_source.size), "shownPixels": int(shown.sum()),
            "sourceQuantiles": {"p10": p10, "p50": p50, "p90": p90},
            "cvMedian": float(np.median(overlapping_cv)),
            "cvP90": float(np.percentile(overlapping_cv, 90)),
        },
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Render the reviewed Mediterranean density model")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    render(args.source, args.image, args.manifest)


if __name__ == "__main__":
    main()
