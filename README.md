# Pattern / laser

Browser-based utility for converting leather-pattern PDFs into SVG cut geometry for xTool Studio. Current version: **0.4.0**.

The utility supports original vector extraction, selected-area raster centreline tracing, duplicate cleanup, manual operation assignments, box selection, calibration and SVG export. Files are processed locally in the browser.

## Use the tool

Open [the public GitHub Pages utility](https://disneymax.github.io/pattern-laser/), use [the private ChatGPT Site](https://pattern-laser.juicyweaver4.chatgpt.site/) with the Site owner account, or download and open [`standalone/Pattern_Laser_Utility.html`](standalone/Pattern_Laser_Utility.html) in recent desktop Chrome or Edge. The standalone HTML embeds PDF.js and the supplied YOMMY sample; it needs no server or CDN.

Follow the [step-by-step user guide](docs/USER_GUIDE.md), or download the [PDF guide](docs/Pattern_Laser_User_Guide.pdf).

## Try the reviewed sample

1. Open the utility and click **Open project**.
2. Choose [`examples/YOMMY_reviewed.pattern.json`](examples/YOMMY_reviewed.pattern.json).
3. Inspect **Overlay** and verify dimensions before export.
4. Use [`examples/100mm_calibration.svg`](examples/100mm_calibration.svg) to check xTool Studio import scale. Its rectangle geometry should measure **100 × 20 mm**; its canvas includes margins.

The reviewed YOMMY project contains five outer contours, 438 stitch-hole contours and one internal cutout. Sample SVGs, individual-piece exports and the geometry report are in [`examples/`](examples/). The source PDF is included as `CARD HOLDER YOMMY.pdf` for the bundled demo and build.

## Develop and build

Requires Node.js compatible with PDF.js 5.6.205 (Node 22.13+ or Node 24+) and Python 3.

```sh
npm ci
npm test
npm run build
```

The build writes `dist/Pattern_Laser_Utility.html`. Open that file directly in the browser. Build options include `--sample`, `--output` and `--pdfjs-dir`:

```sh
python3 build.py --output dist
```

The source modules, HTML template, build script and tests live at the repository root. `standalone/` contains the current prebuilt utility; rebuild it after making changes. `docs/START_HERE.md` retains the historical release and validation notes from the distribution bundle; its original folder references describe that bundle.

## Validation and limits

The current default suite contains 108 automated geometry, raster, download, UI-controller, appearance and box-selection checks. Optional real-pattern fixtures can be supplied through the environment variables documented in the test files. Automated state tests use DOM doubles. User testing confirmed that 4–5 exports looked correct in xTool Studio, with correct physical dimensions for patterns containing a 1-inch calibration square. Those manual results are not automated fixtures; interactive browser automation and machine processing remain unverified.

Raster tracing approximates the printed design. Review the overlay, operation assignments and physical scale before exporting. SVG colours do not include laser power, speed or processing assignments. This version does not assemble tiled sheets, nest pieces or calculate kerf.

## Dependencies and sample rights

PDF.js is pinned to 5.6.205 and licensed under Apache 2.0; its license is included in [`THIRD_PARTY_LICENSES/`](THIRD_PARTY_LICENSES/) and embedded in the standalone HTML. Sample patterns retain their original rights. No license for the original application or pattern artwork is granted by this repository.

## Automated tests and GitHub Pages

The [Test, build and deploy Pages workflow](https://github.com/DisneyMax/pattern-laser/actions/workflows/pages.yml) runs on pushes and pull requests targeting `main`, and can also be started manually.

- Every run installs locked dependencies on Node.js 24 and Python 3.12, runs the regression suite, builds the app, and checks generated JavaScript and local download/guide links.
- Successful pushes to `main` deploy the tested `_site/` artifact to GitHub Pages. Pull requests validate the build without publishing.
- Failed tests or builds stop deployment. The previously deployed site stays available.

Commit and push source changes to `main`; rebuilding tracked HTML by hand is no longer required. For local verification:

```sh
npm ci
npm test
npm run build:pages
python3 verify-pages.py
```

`_site/` contains the hosted app, a freshly built standalone HTML download, guides and samples. It is generated and ignored by Git. The root `index.html` and `standalone/` tracked HTML files are earlier snapshots; the workflow always rebuilds from the source modules. Download the latest offline utility from the live site's Downloads & guide page.

**One-time owner setup:** in [Settings → Pages](https://github.com/DisneyMax/pattern-laser/settings/pages), choose **GitHub Actions** under Build and deployment → Source. The connected integration and workflow token cannot change this setting (GitHub returns HTTP 403). Then rerun the workflow from its Actions page. Deployment checks this setting to prevent the legacy branch publisher from bypassing the tests. The private ChatGPT Site remains separate and requires its own deployment.
