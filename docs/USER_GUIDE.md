# Pattern / laser — step-by-step user guide

For version 0.4.0 · Updated November 20, 2026

Convert leather-pattern PDFs into SVG geometry for xTool Studio. Start with the practice project below, then follow the numbered workflow for your own PDF. Files opened in the utility are processed in your browser. The offline HTML contains its PDF engine and the supplied YOMMY sample.

## Practice with the reviewed sample

1. Open the utility and click **Load reviewed YOMMY sample**, or **Explore reviewed sample** in the empty preview. The reviewed project loads directly, including in the offline HTML.
2. Confirm that Export SVG is enabled and there are no unresolved paths. You can also download `YOMMY_reviewed.pattern.json` from Downloads & guide and open it with Open project.
3. Click **Overlay**. You should see five outer contours, 438 stitch-hole contours and one internal cutout. Turn on Reference under Preview layers to inspect excluded artwork.
4. Click **Select**, then left-drag a small box around several stitch holes. Their selection highlights and the inspector count should change. Press Escape to clear the selection.
5. Continue with steps 6–9 below to check scale and export. Use **Open original PDF (needs review)** only for cleanup practice: it loads the original PDF with conservative defaults and seven paths to review. The main sample buttons load the reviewed corrections instead.

## 1. Open your PDF and choose a page

1. Open the hosted utility, or open `Pattern_Laser_Utility.html` in a recent desktop Chrome or Edge browser for offline use.
2. Click **Open a pattern PDF**, or drop your PDF onto the import area.
3. Choose the required **Page**. Instruction pages, photographs and pattern pages may be separate.
4. Check **Conversion engine**. Use Vector extraction for PDFs containing drawing paths. Image-only pages automatically open in Raster trace mode.

Work on one page at a time. **Save project before switching pages**: switching pages resets that page's edits and calibration. This version does not assemble tiled pattern sheets.

## 2. Extract the pattern geometry

### A. Vector PDFs

1. Leave **Remove duplicate geometry** and **Join unambiguous endpoints** enabled initially.
2. Inspect the generated geometry in **Cut paths**, then choose **Overlay** to compare it with the PDF.
3. Check **Inspection notes** and the export review message. Text, clipping and complex artwork may require closer inspection even when paths are present.
4. If there are no useful paths, or the visible pattern is missing, try Raster trace using the next workflow.

Keep the default join tolerance initially. Increase it only after inspecting the actual gap. **Rebuild from source** applies the cleanup settings again and resets manual edits; save your project before experimenting. The utility leaves branches and larger gaps for review.

### B. Scanned or image-based PDFs

1. Choose **Raster trace (image patterns)** if it is not already selected.
2. Click **Select area on PDF** and drag around one pattern piece. Include the whole outline; leave nearby labels, logos and dimension lines outside where possible. For precision, enter X, Y, Width and Height under **Area coordinates · mm**.
3. Start with **Render DPI: 300** and **Darkness threshold: 150**. Click **Preview threshold** to inspect the black-and-white result.
4. Lower the threshold to suppress light watermarks. Raise it if faint outlines disappear. Check that the outline remains continuous.
5. Decide whether to enable **Include small round marks** for stitching/round marks and **Include short open lines / dashes** for guides. These are omitted by default. **Suppress selectable PDF text** helps remove actual PDF text; it cannot reliably identify lettering baked into a scanned image.
6. Click **Trace area**. Inspect the result in Overlay. Changing settings or previewing the threshold does not update existing paths: trace the area again to apply changes.
7. Repeat for the other pieces, using separate areas. Re-tracing substantially the same area replaces that trace; partly overlapping areas are rejected.
8. Finish tracing all pieces before manual editing. Tracing rebuilds the page and resets manual cleanup.

Raster tracing approximates printed lines with single centreline paths. Small round-mark sizes are estimates. If noise remains, adjust **Minimum speck area** or **Remove short branches** cautiously; aggressive cleanup can remove intended detail. **Tolerance · mm** controls path simplification, rather than guaranteeing accuracy against the original pattern.

## 3. Compare the result with the PDF

1. Use **PDF** to inspect the source, **Cut paths** to see extracted geometry, and **Overlay** to compare both. Raster mode also offers **Threshold**.
2. Increase **Zoom** to inspect corners, stitch holes, cutouts and open endpoints. Use **Fit** to return to the page view.
3. Toggle **Preview layers** to isolate groups. Enable Reference when checking what was excluded.
4. Look for missing outlines, duplicate cuts, unexpected text or guides, incorrectly classified holes, and gaps or unwanted branches.

Preview visibility controls what you see. Export checkboxes separately control which assigned operations appear in the SVG. Hiding a preview layer does not exclude it from export. Reference artwork is always excluded.

## 4. Select one path or a group

1. In **Cut paths** or **Overlay**, click **Select**.
2. Click a path or its object-list row to select one item. **Shift-click** adds or removes individual items.
3. Hold the **left mouse button** and drag a box to select several paths. Only whole visible paths fully inside the box are selected. You can start on a path or the workspace grid.
4. Use **Shift-drag** to add another group. The live count and blue highlights show the proposed selection.
5. Press **Escape** during a drag to cancel it. After selection, Escape clears the selection.
6. For category-wide editing, choose a category in **Object list**, then click **Select all listed objects**.

To select stitch holes without selecting the surrounding panel, box only the holes. A box does not trim or split a path where it crosses the box edge. Measure and Select area on PDF use their own tools; return to Select for geometry selection. Touch scrolling does not create a selection box.

## 5. Assign operations and repair geometry

1. Choose **Needs review** in Object list to find unresolved paths.
2. Select a path or group and inspect its position in Overlay.
3. Choose the appropriate **Assign operation** entry. Use **Exclude** for labels, construction artwork and other unwanted geometry.
4. Repeat until all review items and any suspected excluded features have been inspected. Use **Review excluded features** when that button appears.

The operation groups are:

- **Red — outer cuts:** the main piece boundaries.
- **Magenta — stitch holes:** stitching contours or marks you intend to process.
- **Purple — fastener / round marks:** hardware holes or position marks; verify their purpose.
- **Orange — internal cuts:** slots, windows and other internal cutouts.
- **Blue — score / fold:** guides intended for scoring.
- **Reference:** artwork excluded from SVG export.
- **Needs review:** unresolved geometry that blocks export.

For guided review, use **Next item** or **Previous item** under Review paths. Each item is selected, revealed and fitted into the preview. Explanations distinguish small gaps, branching endpoints, clipping and features needing operation assignment; gap measurements use source millimetres.

**Preview suggested repair** shows a dashed blue closing/joining proposal over the faded original paths. Inspect it, then choose **Apply repair**, **Cancel preview**, or Escape. Previewing changes no geometry. Applying adds one Undo step and resets raster review acknowledgement. Export and project saving wait until you apply or cancel. Tolerance, view or editing changes discard the pending preview.

Suggestions bridge gaps of at most 0.2 mm without changing the global join tolerance. Ambiguous branches, clipped paths, large gaps and uncertain operations stay manual. Unrelated assignments are preserved: inspect internal-cut roles after joining a new outer boundary. The preview does not guarantee a valid or self-intersection-free cutting contour.

For geometry repairs:

- **Join selected paths** joins selected open paths when their endpoints match unambiguously within the current tolerance. Selected closed paths keep their geometry and assignments. Review the joined result and assign its operation.
- **Close gap** closes an open path only when its endpoint gap fits the current join tolerance. Inspect the closing segment before keeping it. Supported join tolerance is at most 0.2 mm.
- **Split segments** breaks selected paths into individual segments and returns those segments to Needs review. Use it to isolate an unwanted spur, then exclude or rejoin the necessary segments.
- **Undo** restores the previous geometry edit. The session retains up to 25 edits. Ctrl+Z or Command+Z works when you are not typing in a field.

“Ambiguous branches remain separate” means a junction offers more than one possible continuation. The tool leaves those paths separate for you to inspect. It is a review message. Remove an unwanted construction branch or select only the intended open segments before trying Join again. Assigning an open path does not close it; export can retain explicitly assigned open cuts.

## 6. Verify physical scale

1. Find a printed dimension or another known distance on the pattern.
2. Click **Measure**, then click the two endpoints of that distance in the preview. The source distance appears in **Measured in PDF · mm**.
3. Enter the intended size in **Known distance · mm**. For example, if a printed 100 mm feature measures 99.5 mm, enter Known = 100 and Measured = 99.5.
4. Click **Apply calibration ratio**. The utility scales the output uniformly. Check another dimension to confirm the result.
5. For precise geometry dimensions, select the path and inspect its reported width and height; mouse measurements are approximate. Use **Reset to PDF size** to return to the original scale.

Calibration cannot correct a stretched or distorted scan independently in each direction. In raster mode, finish editing and calibration, then confirm **I checked the overlay and verified scale**. Further tracing, geometry edits or calibration changes require a fresh review.

## 7. Save your editable project

1. Click **Save project** and save the `.pattern.json` file through the save dialog.
2. Keep the original PDF with it. The project is a current-page snapshot containing geometry, edits, calibration, export choices and a reference image.
3. To resume, click **Open project** and select the saved file.
4. To continue tracing a restored raster project, click **Attach original PDF to continue tracing** and select the same PDF. The utility checks its identity and page size. Restored raster projects require fresh overlay and scale review before export.

An SVG is the exported geometry. Use the project file when you want to resume editing in this utility. Browser theme and hover-hint preferences are saved separately from projects.

## 8. Export the SVG and report

1. In **Export setup**, choose which operation groups to include. Check the inventory's included and total counts, including any omissions.
2. Leave **Resize circular stitch holes** off to preserve the source holes. If enabled, enter the desired final output **Diameter · mm**. This affects recognized circular stitch holes, not the separate fastener layer.
3. Choose **SVG canvas: Full page** to retain the page canvas, or **Fit geometry** to reduce the canvas around the included geometry.
4. Resolve remaining review items. For raster traces, confirm the overlay/scale review checkbox after the final edit.
5. Click **Export SVG**. To export a single recognized closed outer piece with its contained assigned features, use that piece's **SVG** button when available. Page-wide review requirements still apply.
6. Click **Download geometry report** to save the JSON inventory and inspection information. Keep it with the project and SVG for reference.
7. Click **Download 100 mm calibration SVG** for the xTool import check in step 9.

Each save opens **Save your file**. Click **Download file**, or **Save as…** where supported. If downloading is blocked, use **Open file** and save from the new tab, or **Copy contents** into a plain-text editor and save with the correct `.svg` or `.json` extension. The dialog also offers a link to open the utility in a browser tab. Check the saved file: a download request alone cannot confirm that your browser saved it.

## 9. Import into xTool Studio

1. Import the calibration SVG first. Select its rectangle and confirm that the **geometry measures 100 × 20 mm**. The SVG canvas is 110 × 30 mm because of its margins.
2. If the rectangle imports at another size, check Studio's SVG import DPI and sizing settings. Keep original dimensions instead of fitting to the machine bed, then repeat the check.
3. Import your pattern SVG and verify a known piece dimension as well. Studio may report selected geometry bounds rather than the SVG canvas size.
4. Select each colour group and assign the appropriate processing operation and settings for your material and machine. SVG colours do not carry laser power, speed, passes or automatic Cut/Score assignments.
5. Where supported, use processing **By layer** and place stitch holes and internal cuts before outer boundaries.

For the reviewed YOMMY sample, the upper-right rounded panel measures approximately **77.500 × 105.000 mm**. Its full-page SVG canvas measures 215.9 × 279.4 mm. These are different measurements; compare the matching geometry or canvas value.

This guide describes the utility's export workflow. Import into xTool Studio and machine processing have not been validated here; verify dimensions in your installed Studio version before processing.

## 10. Appearance and help

- Click **Dark theme** to switch appearance. The utility follows your system until you choose a theme, then remembers the choice in this browser.
- Leave **Show hover hints** on for short hints after an 800 ms pause, or turn it off for quieter navigation.
- Click **?** beside a setting, or focus a control and press **F1**, for its full explanation. Click the question mark again, click outside, or press Escape to dismiss help.

## Troubleshooting

### “Paths still need review” blocks export

Choose Needs review in Object list, select the relevant paths, and assign an operation or exclude them. Review suspected exclusions when prompted. If many stitching holes are unresolved, box-select a group and assign it together after checking the overlay. Finish the raster review acknowledgement when applicable.

### A pattern produces no cut outlines

Confirm that you chose the pattern page. Try Raster trace if the PDF is an image or vector extraction misses the visible design. Select one complete piece, inspect the threshold and trace it. Check whether a recovered outline is under Needs review instead of an assigned cut operation.

### The box misses a path or selects nothing

Use Select in Cut paths or Overlay, make the relevant preview layer visible, and enclose the complete path. Dragging across only part of a large contour does not select it. Zoom out if necessary. The object list is another way to select a difficult path.

### Stitching marks are missing from raster traces

Enable Include small round marks and trace the affected area again. Inspect the threshold to make sure the marks survive. Finish tracing before reapplying manual edits; the retrace resets manual cleanup.

### A logo, watermark or dimension line becomes geometry

Tighten the raster area, lower the threshold for pale artwork, or enable selectable-text suppression where applicable, then retrace. Inspect remaining unwanted paths and Exclude them. A threshold cannot separate overlapping marks of the same darkness reliably.

### A closed outline remains broken after Join

Inspect endpoints, the current join tolerance and possible branches. Join does not guess through ambiguous junctions or bridge large gaps. Use Split segments only when needed to isolate a spur, and compare every repair with the PDF.

### The SVG is the wrong size

Recheck Known and Measured distances, the output calibration ratio and Studio's import settings. Test the calibration rectangle separately. Resizing the SVG canvas and checking a selected object's bounds are different operations.

### Limits to keep in mind

This version does not assemble tiled pages, nest pieces, calculate kerf, repair arbitrary self-intersections or turn PDF text into precise cutting outlines. Clipping and composited artwork can prevent faithful vector extraction. Raster tracing provides approximate geometry and needs comparison against the source. Keep the original PDF and an editable project alongside your exported files.
