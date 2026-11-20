# Pattern / laser

Browser-based utility for converting leather-pattern PDFs into SVG cut geometry for xTool Studio. Current version: **0.4.0**.

The utility supports original vector extraction, selected-area raster centreline tracing, duplicate cleanup, manual operation assignments, box selection, calibration and SVG export. Files are processed locally in the browser.

## Use the tool

Open [the public GitHub Pages utility](https://disneymax.github.io/pattern-laser/), use [the private ChatGPT Site](https://pattern-laser.juicyweaver4.chatgpt.site/) with the Site owner account, or download and open [`standalone/Pattern_Laser_Utility.html`](standalone/Pattern_Laser_Utility.html) in recent desktop Chrome or Edge. The standalone HTML embeds PDF.js and the supplied YOMMY sample; it needs no server or CDN.

Follow the [step-by-step user guide](docs/USER_GUIDE.md), or download the [PDF guide](docs/Pattern_Laser_User_Guide.pdf).

## Try the reviewed sample

1. Open the utility and click **Load reviewed YOMMY sample** (or **Explore reviewed sample** in the empty preview).
2. The reviewed project loads with five outer contours, one internal cutout, 438 stitch holes and no unresolved paths. The project JSON remains available at [`examples/YOMMY_reviewed.pattern.json`](examples/YOMMY_reviewed.pattern.json) for manual import.
3. Inspect **Overlay** and verify dimensions before export. **Open original PDF (needs review)** loads the unedited PDF with conservative 0.03 mm joining and its seven unresolved paths for cleanup practice.
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

The source modules, `index.template.html`, `styles.css`, `theme-init.js`, build scripts and tests live at the repository root. `standalone/` contains the current prebuilt utility; rebuild it after making changes. `docs/START_HERE.md` retains the historical release and validation notes from the distribution bundle; its original folder references describe that bundle.

## Validation and limits

The current default suite contains 149 automated geometry, raster, download, UI-controller, appearance, box-selection and runtime-asset checks. Optional real-pattern fixtures can be supplied through the environment variables documented in the test files. Automated state tests use DOM doubles. User testing confirmed that 4–5 exports looked correct in xTool Studio, with correct physical dimensions for patterns containing a 1-inch calibration square. Those manual results are not automated fixtures; Chromium UI automation now covers the main hosted and offline workflows; machine processing remains unverified.

Raster tracing approximates the printed design. Review the overlay, operation assignments and physical scale before exporting. SVG colours do not include laser power, speed or processing assignments. This version does not assemble tiled sheets, nest pieces or calculate kerf.

## Dependencies and sample rights

PDF.js is pinned to 5.6.205 and licensed under Apache 2.0; its license is included in [`THIRD_PARTY_LICENSES/`](THIRD_PARTY_LICENSES/) and embedded in the standalone HTML. Sample patterns retain their original rights. No license for the original application or pattern artwork is granted by this repository.

## Automated tests and GitHub Pages

The [Test, build and deploy Pages workflow](https://github.com/DisneyMax/pattern-laser/actions/workflows/pages.yml) runs on pushes and pull requests targeting `main`, and can also be started manually.

- Every run installs locked dependencies on Node.js 24 and Python 3.12, runs the regression suite, builds the app, checks generated JavaScript and local download/guide links, opens the emitted sample using the emitted PDF engine/worker, and runs the Playwright UI suite before deployment.
- Successful pushes to `main` deploy the tested `_site/` artifact to GitHub Pages. Pull requests validate the build without publishing.
- Failed tests or builds stop deployment. The previously deployed site stays available.

Commit and push source changes to `main`; rebuilding tracked HTML by hand is no longer required. For local verification:

```sh
npm ci
npm test
npm run build:pages
python3 verify-pages.py
node verify-runtime.mjs
npx playwright install chromium
npm run test:ui
```

`_site/` contains the hosted app, a freshly built standalone HTML download, guides and samples. The hosted HTML loads separate CSS, theme bootstrap and app JavaScript, plus separate PDF engine, worker, original sample PDF and reviewed-project assets. Asset filenames contain content hashes so browsers can cache unchanged files independently. All assets use relative URLs compatible with the `/pattern-laser/` project path. The offline download still embeds its CSS, JavaScript, PDF engine, worker, original sample PDF and reviewed project; it needs no companion files. It is generated and ignored by Git. The tracked `standalone/` HTML is a prebuilt snapshot; the workflow always rebuilds both hosted and offline versions from the source modules. Download the latest offline utility from the live site's Downloads & guide page.

**One-time owner setup:** in [Settings → Pages](https://github.com/DisneyMax/pattern-laser/settings/pages), choose **GitHub Actions** under Build and deployment → Source. The connected integration and workflow token cannot change this setting (GitHub returns HTTP 403). Then rerun the workflow from its Actions page. Deployment checks this setting to prevent the legacy branch publisher from bypassing the tests. The private ChatGPT Site remains separate and requires its own deployment.

## Playwright UI regression tests

The 31 Chromium scenarios exercise the built site at `/pattern-laser/`, matching the deployed project path. They cover real PDF/sample import and worker loading, reviewed YOMMY SVG contours and scale, calibration/report downloads, pointer box selection and Shift-click, cancellation, bulk edits and Undo, project save/reopen, image-only PDF tracing and its review gate, physical calibration, preview/export inclusion, persisted themes and hover preferences, delayed and keyboard help, download/guide navigation on a narrow viewport, failed sample requests, and standalone/offline operation.

```sh
npm ci
npm run build:pages
npx playwright install chromium
npm run test:ui
```

The test runner starts its own local static server and uses isolated browser contexts. Tests interact through the UI rather than changing application state from test code. The image-only PDF and selection projects are generated fixtures; reviewed YOMMY files are the existing repository sample. Run `npm run test:ui:headed` for a visible browser, or `npx playwright show-report` to inspect the HTML report.

CI installs Chromium and its operating-system dependencies, runs all UI tests, and retains reports, downloads and failure screenshots/traces for 14 days. A UI failure blocks Pages deployment. Pull requests run the same checks without publishing. One retry is allowed in CI to capture intermittent failures, but flaky tests still fail the job.

To use an already-installed Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Managed environments that explicitly block `file://` navigation can set `PLAYWRIGHT_SKIP_FILE_URL=1` locally; this skips only the direct-file case. The network-disconnected standalone test still runs. CI does not set that flag and must pass the direct-file test as well.

## Guided path review

Use **Next item** or **Previous item** in Review paths to select, reveal and fit each unresolved or possibly excluded path. The explanation reports endpoint gaps and the current join tolerance in source millimetres, or identifies clipping, branching and operation-assignment issues.

For an eligible open path, **Preview suggested repair** shows a dashed blue contour over faded originals. Suggestions close a small gap or join a uniquely connected component into one closed contour, with a maximum bridged gap of 0.2 mm. They do not change geometry, consume Undo history, or alter the global cleanup tolerance. Export and project saving pause while a preview is pending.

Inspect the overlay and resulting operation, then choose **Apply repair**, **Cancel preview**, or Escape. Applying records one Undo step and invalidates raster overlay/scale acknowledgement. Changing geometry, tolerance, view or editing tools discards the pending preview. Stale previews cannot be applied.

Branches, clipped/unsupported paths, ambiguous connections, large gaps and closed unassigned features remain manual decisions. No paths are automatically excluded. Repairs preserve unrelated assignments: after joining a new outer contour, check the operations of its internal features. Preview does not validate arbitrary self-intersections or guarantee cutting suitability.

## Pattern corpus regression coverage

`npm run test:patterns` runs 15 end-to-end PDF pipeline checks using original, programmatically generated artwork. These checks are also part of `npm test` and public CI. They cover A4/Letter equivalence, filled stitch dots, fasteners, internal cuts, a 25.4 mm calibration square, hole sizing, duplicate painting, nested transforms, page rotation, CropBox origins, rectangular clipping, small gaps/branches, and multi-panel raster tracing with light watermark suppression and optional round marks. Four additional browser scenarios exercise these PDFs through import, page selection, tracing, review and export.

Vector dimensions have a 0.002 mm tolerance; raster dimensions/mark positions use a 0.3 mm tolerance. At lower raster resolution, mark diameters and inferred operation roles can vary: the low-resolution test requires preservation of all positions rather than assuming every round mark is stitching. The 300 DPI baseline retains all 12 stitch suggestions.

The optional supplied-PDF corpus is separate. See [tests/patterns/README.md](tests/patterns/README.md) for local setup and provenance. Only hashes, aggregate counts and measurements are committed. Additional third-party PDFs and derived artwork are not included in public CI, the Pages build or test artifacts. No individual supplied file is represented as machine-tested merely because its automated baseline passes.
