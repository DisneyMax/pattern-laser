# Pattern / laser — first working version

For the step-by-step workflow, open `user-guide.html`, read `USER_GUIDE.md`, or use `Pattern_Laser_User_Guide.pdf`.

Open `Pattern_Laser_Utility.html` in a recent desktop Chrome or Edge browser. It is a single offline HTML file: the PDF engine and supplied YOMMY test PDF are embedded. No server, account, CDN or file upload is needed. This version includes vector extraction and selected-area raster centreline tracing.

## Version 0.4.0 — drag to select multiple paths

In **Cut paths** or **Overlay**, use **Select** and hold the left mouse button while dragging a box. Whole visible paths fully inside the box are selected; partial paths and the surrounding outer boundary stay unselected. Dragging can begin on a path or the workspace grid. Shift-drag adds to the selection; Shift-click toggles individual paths. A live count and blue highlights preview the result. Escape during a drag cancels it; Escape afterwards clears selection.

Use **Assign operation**, **Exclude**, **Close**, **Join** or **Split** in the inspector to edit the selected group. Join processes selected open paths and preserves selected closed paths and their operations. Selection alone never alters geometry. Use Undo after an edit to restore the previous geometry. This selects complete paths; it does not cut a path at the box edges. Measure and raster-area selection keep their own drag behavior. Touch scrolling does not start a selection box.

Verification: 16 box-selection checks, nine controller checks and 21 appearance checks, including group assignment/exclusion, Undo, mixed open/closed joins, containment, Shift-add, transforms, cancellation and click suppression. Tests use DOM doubles; interactive browser and xTool Studio testing remain unverified.

## Version 0.3.2 — quieter help

**Show hover hints** in the header is a saved browser preference. When enabled, a brief hint appears only after an 800 ms mouse hover. Passing over a control quickly produces no hint. Clicking, typing, dragging, editing or scrolling cancels pending hints and dismisses ordinary popups. Touch interaction does not automatically open hover hints.

Keyboard focus no longer opens visual popups; complete descriptions remain available to screen readers. Click **?** or press **F1** on a control to open its full explanation immediately, even when hover hints are off. Full help stays open until dismissed or work resumes. Click **?** again, click outside, or press Escape to dismiss it. Native control/path tooltips have been replaced by the shared hint behaviour so they do not bypass the preference.

Verification for this update: 21 appearance/behaviour checks plus six controller regression checks. Fake-clock tests cover the full 800 ms delay, rapid pointer navigation, cancelled hints, dragging/touch, saved hover-off preferences, quiet keyboard focus, F1, Escape, and question-mark keyboard/touch operation. Conversion algorithms retain the earlier baseline; interactive browser QA remains unverified.

## Version 0.3.1 — dark theme and contextual help

Use **Dark theme** in the header to toggle the interface. It follows your operating system until you choose a mode, then remembers that choice in this browser. If browser storage is blocked, the toggle still works for the current session. The PDF paper and exported layer colours remain consistent so the dark interface does not change interpretation of the source.

The original hover/focus behaviour introduced here is refined by version 0.3.2 above. Click the **?** beside technical fields and checkboxes to keep help open for reading, including on touch devices. Click it again, click outside, or press Escape to dismiss. Help covers tracing thresholds, DPI and tolerances, crop coordinates, speck/branch cleanup, optional marks and guides, geometry joins and edits, calibration, layer visibility versus export inclusion, review gates, saving and download alternatives. Generated object-list controls, layer switches and individual-piece exports also have explanations.

Verification for this UI update: 12 appearance checks (saved/system themes, blocked storage, early theme selection, actual dark palette contrast, static control help coverage, accessibility descriptions, toggle behaviour, viewport positioning, Escape and touch-style dismissal) plus six controller regression checks. These use unit/DOM doubles, not an interactive browser. The earlier 83 geometry, raster, download and controller baseline checks remain documented below and available in the source test suite.

## Version 0.3.0 — raster tracing for image-based patterns

Image-only pages now open in **Raster trace** mode and show an explicit action instead of appearing to complete without paths. You can also select Raster trace in the engine selector for a different page. Vector and raster modes are separate: switching engines rebuilds the current page instead of mixing two copies of the same geometry.

1. Click **Select area on PDF** and drag around one pattern piece. Leave logos and dimension labels outside. You can enter exact X/Y/width/height under Area coordinates.
2. Use **Preview threshold**. At a threshold of 150, the supplied Hahns pattern's light watermark disappears while its dark outlines remain. Lower the threshold to ignore light backgrounds; raise it for faint lines. Preview does not regenerate existing paths—click Trace area to apply settings.
3. Click **Trace area**, then repeat for other non-overlapping pieces. Re-tracing substantially the same area replaces it. Partly overlapping areas are rejected to avoid accidental duplicate cuts. Tracing rebuilds geometry and resets manual cleanup, so finish tracing before assigning operations.
4. Default mode keeps cut outlines and reports how many small round marks and short open guides were omitted by those options. Enable **Include small round marks** to retain estimated mark positions/sizes, or **Include short open lines / dashes** to retain guides for assignment. Long broken contours stay under review regardless of those options.
5. Inspect **Overlay**, assign/exclude unresolved paths, and use **Physical scale** with a printed dimension. Check the inspector's exact bounds or use Measure to obtain the source distance. Raster tracing does not assume the printed scale is perfect.
6. Confirm **I checked the overlay and verified scale**, then export. New tracing, geometry edits or calibration changes invalidate that review. The export inventory records omitted marks and guides, and geometry reports contain each area's settings and trace statistics.

The implementation thresholds the PDF render, removes small speckles, thins strokes to a single centreline, removes short dangling branches and simplifies paths in millimetres. This avoids cutting both edges of a printed line. It creates approximate polylines, not exact CAD curves. Tolerance describes simplification relative to skeleton pixels, not guaranteed accuracy against the original design. Printed dot sizes are estimates; choose an explicit stitch-hole diameter if needed. Dark overlapping marks and heavy texture can still require cleanup.

### Example areas for the supplied Hahns A3 page

With 300 DPI, threshold 150, tolerance 0.08 mm and branch cleanup 1.2 mm, these page-space areas recovered its three outlines in PDF.js rendering:

| Piece | X mm | Y mm | Width mm | Height mm |
| --- | ---: | ---: | ---: | ---: |
| Upper shaped panel | 46 | 109 | 123 | 79.4 |
| Lower shaped panel | 46 | 221 | 123 | 81 |
| Long rectangle | 196 | 109 | 58 | 194 |

These coordinates apply to this particular approximately 297.01 × 419.95 mm page. Adjust areas for other layouts. A looser upper selection can capture a dimension line below the panel; it remains a review item rather than being silently cut.

The three recovered bounds agree with the printed 120 × 78 mm, 120 × 78 mm and 55 × 190 mm references within 0.3 mm before calibration. Enabling round marks also retained 64 stitching suggestions. This validates the supplied example, not arbitrary scanned PDFs.

Raster projects save geometry, areas, settings and a reference image, not a full-resolution source canvas. Use **Attach original PDF to continue tracing** to resume; the PDF fingerprint and page dimensions are checked before attachment. A restored raster project needs fresh overlay/scale review. Undo can restore a cleared trace or an engine/calibration change.

## Version 0.2.0 — stitch markers, fasteners and export inventory

- Filled black and gray stitch dots inside pattern panels are recognized using repeated geometry and spacing. MakeSupply Letter and A4 each retain all 96 stitch dots (45 + 45 + 6) and two separate fastener marks, along with their three outer contours. Branding stays excluded. Original paths and sizes are preserved by default.
- **Fastener / round marks** is a separate purple layer. Isolated round marks are not treated as stitch holes. The optional stitch-hole resizing control never changes this layer. A printed round mark may be a position guide; verify its intended purpose and size.
- Dimension groups are identified from two opposing triangular arrowheads, the connecting baseline and both witness lines. Colour alone does not exclude geometry. MONEYCLIP's 60 dimension paths are excluded; its 354 and 164 stitch-hole contours remain. Eight open paths on page 1 and ten on page 2 still need explicit assignments.
- The **export inventory** shows included/total objects for every operation. Unrecognized filled features inside a panel and suspected automatic omissions block export until assigned or explicitly excluded. Turning off an operation's export checkbox shows how many objects that choice omits. Geometry reports include the audit and inferred roles.
- Saved project snapshots get the new automatic classifications while retaining manual assignments. Old snapshots enable the new fastener layer; new snapshots retain your chosen export layers. Reopen PDFs or project files after refreshing the app to apply the new classifier.

Role detection remains a suggestion: similarly arranged rivets or decorative dots can resemble stitching. Compare the overlay and assign operations as needed. Filled artwork outside recognized panels can remain reference artwork and needs inspection. Vector extraction still does not reconstruct Pick Case's composited visible outline. Raster trace is available as a separate selected-area approach; the automated raster fixture is Hahns.

## Save calibration SVGs and geometry reports

Export buttons now open **Save your file**. Click **Download file**, or use **Save as…** where supported. If the embedded browser blocks downloads, use **Open file** and save it from the new tab, or **Copy contents** and save the exact SVG/JSON text in a text editor. The dialog also links to the utility in its own browser tab. A success message is shown only after a native Save as operation completes; ordinary download requests cannot be confirmed by the page.

## Try the reviewed result

1. Open the HTML utility.
2. Click **Open project** and choose `YOMMY_reviewed.pattern.json`.
3. Switch to **Overlay** to compare the extracted paths against the PDF. Enable **Reference** under Preview layers to inspect excluded artwork. Preview visibility does not change export inclusion.
4. Inspect the red boundaries, magenta stitch holes and orange internal cutout. The project contains five outer contours, 438 unique stitch-hole contours and one internal cutout. Original Bezier curves and hole geometry are retained.
5. Export SVG, or use the supplied `YOMMY_xtool_reviewed.svg`. The five individual-piece SVGs are in `YOMMY_individual_pieces/`. Individual canvases include a 1 mm source-space margin on each side.

The supplied PNG is a visual preview; its strokes are thickened for legibility. Use SVGs for import.

## Verify scale in xTool Studio

1. Import `100mm_calibration.svg`. Its **rectangle geometry** must measure **100 × 20 mm**. The SVG canvas is 110 × 30 mm because it includes margins.
2. Check Studio's SVG import DPI setting and keep the original dimensions rather than fitting to the machine bed. Test the setting with the calibration file; this utility does not assume which setting your Studio version uses for explicit `mm` units.
3. Import the pattern SVG. A useful size reference is the upper-right rounded panel: its outer geometry measures approximately **77.500 × 105.000 mm**. The full SVG canvas is **215.9 × 279.4 mm**; Studio may report selected geometry bounds rather than the canvas.
4. Select objects by colour and assign processing operations and your material settings. Red = outer cuts; magenta = stitch holes; purple = fastener/round marks; orange = internal cuts; blue = score/fold if present. Hole processing is your choice. SVG colours do not carry power, speed, passes or automatic cut/score assignment.
5. Where your device supports it, choose processing **By layer** and put stitch holes/internal cuts before outer boundaries.

Official guides: https://support.xtool.com/article/2520 and https://support.xtool.com/article/2532

## What changed in the reviewed YOMMY sample

The original PDF contains 569 drawing records, which split into 579 subpaths. Cleanup found repeated whole paths, reversed segments and partially overlapping straight lines. It removed repeated geometry from 410 segments (including partial overlaps); 110 paths became entirely redundant. Closed contours were preferred over repeated fragments.

The reviewed YOMMY sample uses a **0.10 mm** join tolerance. There were **16 joining/closure operations**, with a largest bridged gap of approximately **0.082408 mm**. In addition to the watermark, filled artwork and tiny fragments, two approximately 1.543 mm construction spurs at the upper and lower left corners of the lower-right piece were explicitly excluded (`p342r0` and `p344r0`). This allows the main contour to join without choosing through an ambiguous branch.

The app does not silently apply those sample-specific exclusions to other PDFs. **Try the supplied YOMMY pattern** opens the original PDF with conservative defaults (0.03 mm tolerance), leaving seven open paths for review. The saved reviewed project contains the documented adjustments. **Rebuild from source** resets those edits; Undo restores the prior geometry.

All 438 retained stitch-hole contours measure approximately 1 mm across. The earlier estimate of varying hole sizes came from control-point bounding boxes; exact curve-extrema bounds show the original holes are 1 mm. No hole resizing was applied.

## Review and editing

- Click a path or an object-list button. Shift-click for multiple selection, or use **Select all listed objects** after choosing a category.
- Assign an operation, exclude reference artwork, split a path into segments, or join selected paths. Branches remain separate for review.
- **Close gap** only closes paths whose endpoint gap fits the current tolerance (maximum 0.2 mm). Open cuts can be explicitly assigned and exported as open paths; they are noted in Inspection notes.
- **Measure** takes two clicks in the preview. Enter a known distance and the measured source distance, then apply calibration. Output scale changes uniformly. Use the inspector's exact bounds for precision, since clicking is approximate.
- Hole resizing is opt-in; its diameter is the final output diameter in millimetres, even when output scale changes.
- SVG export stays disabled while any path is assigned **Needs review**. Export checkboxes independently control the assigned operation groups. Reference artwork is always excluded.
- Save a project before switching pages. Projects are current-page snapshots containing source geometry, reference image, edits and export choices. Page switches reset edits and calibration. Undo stores the last 25 geometry edits during the current session.

## Validation and limits

Passed **83 automated checks**: 15 core geometry checks, eight save-helper checks, 11 clipping checks, 23 feature checks, 20 raster checks and six UI state/controller checks with a DOM double. The default source command runs 68 checks; the other 15 use locally supplied PDF fixtures through `LUGGAGE_TEST_PDF`, `PATTERN_CORPUS_MANIFEST` and `HAHNS_TEST_PDF`.

The real Hahns test uses PDF.js at 300 DPI, including selectable-text suppression. It checks three closed outlines without duplicate edge cuts, printed dimension agreement, watermark/branding exclusion, optional 64 point marks, physical SVG dimensions and the raster review gate. The UI state tests cover empty image imports, area selection, export review, calibration/undo, mode switching, project restore and source reattachment. These are unit/state tests and do not replace interactive browser testing.

Both MakeSupply vector exports retain their validated 101 paths (3 outlines + 96 stitching + 2 fastener marks). YOMMY and luggage-tag regressions continue to pass. New pattern PDFs are not included in the download bundle.

Interactive browser QA could not run because the managed browser tool is unavailable in this environment. Import into xTool Studio and machine processing have **not** been tested. The calibration and Studio import check are still required.

This version does not turn PDF text into precise cutting paths, assemble tiled pages, trim vector paths at arbitrary clips, repair self-intersections, perform nesting, or calculate kerf. Raster image patterns can be traced in selected areas, with approximate geometry and explicit review. Rectangular clipping regions are tracked in page coordinates: geometry entirely inside them keeps its normal classification, geometry fully outside them is reference-only, and paths crossing an edge or under arbitrary clipping still require review. Raster images/text and clipping that affects extracted geometry or complex artwork produce inspection notes. Filled/translucent artwork and tiny fragments are classification suggestions; review them against the original. Geometry outside the supported operator subset may require manual treatment. Source PDFs with other features need additional fixtures before claiming compatibility.

## Source code

The `source/` directory contains the geometry and raster engines, interface, build script, pinned PDF.js dependency and tests. Running the optional real raster fixture also requires PDF.js’s optional `@napi-rs/canvas` dependency in Node; this is not needed in the browser. Node.js (a current version supported by PDF.js) and Python 3 are needed for development, but not to open the finished utility.

From `source/`, run `npm install`, `npm test`, then `npm run build`. The result is `dist/Pattern_Laser_Utility.html`. The build accepts `--pdfjs-dir`, `--sample` and `--output` arguments. PDF.js is licensed under Apache 2.0; its license is embedded in the HTML and included in `THIRD_PARTY_LICENSES/`. The supplied pattern remains the user's test input.
