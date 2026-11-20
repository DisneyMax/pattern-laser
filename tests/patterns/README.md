# Pattern regression fixtures

The public suite generates original test PDFs in memory from `fixtures.mjs`; no additional third-party artwork is required. Expected physical dimensions are specified analytically in `pattern-regression-tests.mjs`, including page rotation and crop offsets. The source generator is not an expected-output snapshot of the converter.

Run `npm run test:patterns`, or `npm test`. PDF.js renders the raster fixtures through its normally installed optional `@napi-rs/canvas` dependency. A normal `npm ci` on the supported platforms installs the pinned dependencies. The Playwright suite also imports these generated PDFs through the real UI.

## Optional private corpus

The supplied pattern PDFs remain outside the public repository. Place the exact original files in an external directory, or in the git-ignored `.private-patterns/` directory:

- `LuggageTagPrintInstructions.pdf`
- `Pick Case Pattern.pdf`
- `[HahnsAtelier] 10_Bi-fold wallet.pdf`
- `MONEYCLIP WALLET.pdf`
- `makesupply-keychain-snap-wallet-LETTER.pdf`
- `makesupply-keychain-snap-wallet-A4.pdf`

Then run:

```sh
PATTERN_CORPUS_DIR=/absolute/path/to/your/files npm run test:patterns:private
```

The explicit private command fails if the directory is unset, any required file is missing, or a source SHA-256 differs. It never downloads missing documents or silently treats an incomplete corpus as passing. Private files are read locally; the runner does not write SVGs, images, project geometry or private test reports.

`private-baselines.json` contains file hashes and aggregate expectations for eight pages: page dimensions, operation counts, dimension-annotation counts, image placements, cut width/height measurements and export readiness. Vector page and cut sizes use a 0.01 mm comparison tolerance. It contains no path coordinates/commands, images, source PDFs or traced artwork. These expectations extend the earlier supplied-pattern feature checks and record current conversion behaviour. A matching snapshot alone does not establish design correctness or a successful xTool Studio import.

The private raster checks use the Hahns areas already documented in the user guide at 300 DPI and threshold 150. They verify three contours against the printed 120 × 78 mm / 55 × 190 mm dimensions within 0.3 mm, plus the optional 64 stitching suggestions. MakeSupply Letter/A4 must keep identical physical cut dimensions and the same 96 stitch / 2 fastener counts. MONEYCLIP and Pick Case intentionally retain their review gates; the suite must not bless partial or unsupported conversion as a ready export.

The six PDFs produce 17 private checks, separate from the public CI total. User-reported successful imports and calibration checks are useful practical validation, but they have not been mapped to specific corpus files and do not certify every document in this catalog.

## Updating expectations

Treat a mismatch as a regression until investigated. Check the source hash, original printed measurements, overlay, operation inventory and export gate. For intended converter improvements, review the affected pattern before editing aggregate expectations; do not regenerate and accept every measured value automatically. Keep private document contents and derived outlines out of public commits and artifacts. No private corpus environment variable or document upload is configured in GitHub Actions.
