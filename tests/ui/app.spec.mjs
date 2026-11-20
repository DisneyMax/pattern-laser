import {test,expect,openApp,reviewedProject,selectionProject,drag,point,downloadText,local,rasterPdf,repository} from './helpers.mjs';

test.beforeEach(async({page})=>{await openApp(page);});

test('hosted engine, worker and bundled sample load under the Pages project path',async({page})=>{
 const failed=[];page.on('requestfailed',request=>failed.push(request.url()));
 await page.locator('#sample').click();
 await expect(page.locator('#fileName')).toHaveText('CARD HOLDER YOMMY.pdf');
 await expect(page.locator('#busy')).toBeHidden();
 await expect(page.locator('#viewSummary')).toContainText('215.90 × 279.40 mm');
 expect(await page.locator('#paper .geom').count()).toBeGreaterThan(400);
 await expect(page.locator('#export')).toBeDisabled();
 expect(failed).toEqual([]);
});

test('a user-selected vector PDF is imported through the file input',async({page})=>{
 await page.locator('#file').setInputFiles(local('CARD HOLDER YOMMY.pdf'));
 await expect(page.locator('#fileName')).toHaveText('CARD HOLDER YOMMY.pdf');
 await expect(page.locator('#busy')).toBeHidden();
 await expect(page.locator('#conversionMode')).toHaveValue('vector');
 expect(await page.locator('#paper .geom').count()).toBeGreaterThan(400);
});

test('reviewed YOMMY project retains all 444 assigned contours and exports at page scale',async({page},testInfo)=>{
 await reviewedProject(page);
 await expect(page.locator('#paper .geom')).toHaveCount(444);
 const {text,name}=await downloadText(page,testInfo,()=>page.locator('#export').click());
 expect(name).toMatch(/_xtool\.svg$/);expect(text).toContain('width="215.9mm"');expect(text).toContain('height="279.4mm"');
 const groups=await page.evaluate(svg=>{const doc=new DOMParser().parseFromString(svg,'image/svg+xml');return Object.fromEntries([...doc.querySelectorAll('g')].map(g=>[g.id,g.querySelectorAll('path,circle').length]));},text);
 expect(groups).toEqual({cut:5,holes:438,inner:1});
});

test('calibration download contains the exact 100 by 20 mm rectangle',async({page},testInfo)=>{
 const {name,text}=await downloadText(page,testInfo,()=>page.locator('#calibrationFile').click());
 expect(name).toBe('100mm_calibration.svg');expect(text).toContain('width="110mm"');expect(text).toContain('M5 5H105V25H5Z');
});

test('geometry report download records reviewed operations and scale',async({page},testInfo)=>{
 await reviewedProject(page);
 const {text}=await downloadText(page,testInfo,()=>page.locator('#report').click());const report=JSON.parse(text);
 expect(report.outputScale).toBe(1);expect(report.counts.cut).toBe(5);expect(report.counts.holes).toBe(438);expect(report.counts.inner).toBe(1);expect(report.exportAudit.blocked).toBe(false);
});

test('left-drag selects enclosed visible holes, supports bulk assignment and Undo',async({page})=>{
 await selectionProject(page);await drag(page,[18,18],[35,25]);
 await expect(page.locator('#selectedCount')).toHaveText('2 SELECTED');
 await expect(page.locator('#paper .geom.selected')).toHaveCount(2);
 await expect(page.locator('#paper [data-id="outer"]')).not.toHaveClass(/selected/);
 await page.locator('#assignment').selectOption('score');
 await expect(page.locator('#paper [data-id="holeA"]')).toHaveAttribute('stroke','#00A6D6');
 await expect(page.locator('#paper [data-id="holeB"]')).toHaveAttribute('stroke','#00A6D6');
 await page.locator('#undo').click();
 await expect(page.locator('#paper [data-id="holeA"]')).toHaveAttribute('stroke','#FF00FF');
 await expect(page.locator('#paper [data-id="holeB"]')).toHaveAttribute('stroke','#FF00FF');
});

test('Shift-drag adds a group and Escape clears completed selections',async({page})=>{
 await selectionProject(page);await drag(page,[18,18],[35,25]);await drag(page,[63,48],[77,62],{add:true});
 await expect(page.locator('#selectedCount')).toHaveText('3 SELECTED');
 await page.keyboard.press('Escape');await expect(page.locator('#selectedCount')).toHaveText('0 SELECTED');
});

test('ordinary path clicks and Shift-click retain individual selection behaviour',async({page})=>{
 await selectionProject(page);
 let p=await point(page,20,21);await page.mouse.click(p.x,p.y);
 await expect(page.locator('#selectedCount')).toHaveText('1 SELECTED');
 p=await point(page,30,21);await page.keyboard.down('Shift');await page.mouse.click(p.x,p.y);await page.keyboard.up('Shift');
 await expect(page.locator('#selectedCount')).toHaveText('2 SELECTED');
});

test('Escape cancels an active box without losing the previous selection',async({page})=>{
 await selectionProject(page);await drag(page,[18,18],[35,25]);await drag(page,[63,48],[77,62],{release:false});
 await expect(page.locator('.marquee-box')).toBeVisible();
 await page.keyboard.press('Escape');await page.mouse.up();
 await expect(page.locator('.marquee-box')).toHaveCount(0);await expect(page.locator('#selectedCount')).toHaveText('2 SELECTED');
 await expect(page.locator('#paper .geom.selected')).toHaveCount(2);
});

test('saved projects retain group exclusions when opened again',async({page},testInfo)=>{
 await selectionProject(page);await drag(page,[18,18],[35,25]);await page.locator('#excludeSelected').click();
 const saved=await downloadText(page,testInfo,()=>page.locator('#saveProject').click());const project=JSON.parse(saved.text);
 expect(project.objects.filter(o=>['holeA','holeB'].includes(o.id)).map(o=>o.manualLayer)).toEqual(['reference','reference']);
 await page.reload();await expect(page.locator('#drop')).toBeEnabled();await page.locator('#projectFile').setInputFiles(saved.filename);
 await expect(page.locator('#fileName')).toContainText('selection-fixture.pdf');
 await expect(page.locator('#paper [data-id="holeA"]')).toHaveCount(0);
 await page.getByRole('checkbox',{name:'Show Reference · excluded',exact:true}).check();
 await expect(page.locator('#paper [data-id="holeA"]')).toHaveAttribute('stroke','#858585');
});

test('image-only PDF tracing uses a real worker and requires review before export',async({page})=>{
 await page.locator('#file').setInputFiles({name:'raster-fixture.pdf',mimeType:'application/pdf',buffer:rasterPdf()});
 await expect(page.locator('#busy')).toBeHidden();await expect(page.locator('#conversionMode')).toHaveValue('raster');
 await page.locator('#selectRasterArea').click();await drag(page,[10,10],[90,90]);await expect(page.locator('#traceRaster')).toBeEnabled();
 await page.locator('#traceRaster').click();await expect(page.locator('#busy')).toBeHidden();
 await expect(page.locator('#paper .geom')).toHaveCount(1);
 await expect(page.locator('#rasterReviewed')).toBeEnabled();await expect(page.locator('#export')).toBeDisabled();
 await page.locator('#rasterReviewed').check();await expect(page.locator('#export')).toBeEnabled();
 await page.locator('#known').fill('100');await page.locator('#measured').fill('99');await page.locator('#calibrate').click();
 await expect(page.locator('#rasterReviewed')).not.toBeChecked();await expect(page.locator('#export')).toBeDisabled();
});

test('theme and hover preferences persist, while F1 help stays available',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});await page.reload();await expect(page.locator('#drop')).toBeEnabled();
 await page.locator('#themeToggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.locator('#hoverHints').uncheck();await page.reload();await expect(page.locator('#drop')).toBeEnabled();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('#hoverHints')).not.toBeChecked();
 await page.locator('#themeToggle').focus();await expect(page.locator('#appTooltip')).toBeHidden();
 await page.keyboard.press('F1');await expect(page.locator('#appTooltip')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#appTooltip')).toBeHidden();
});

test('hover hints wait 800 ms and can be disabled without removing full help',async({page})=>{
 await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));await page.mouse.move(1,1);await page.locator('#themeToggle').hover();
 await page.clock.runFor(799);await expect(page.locator('#appTooltip')).toBeHidden();
 await page.clock.runFor(2);await expect(page.locator('#appTooltip')).toBeVisible();
 await page.locator('#hoverHints').uncheck();await page.locator('#themeToggle').hover();await page.clock.runFor(1000);await expect(page.locator('#appTooltip')).toBeHidden();
 await page.locator('#themeToggle').focus();await page.keyboard.press('F1');await expect(page.locator('#appTooltip')).toBeVisible();
});

test('missing hosted sample reports an error and leaves import usable',async({page})=>{
 await page.route('**/assets/yommy.*.pdf',route=>route.fulfill({status:404,body:'missing'}));await page.locator('#sample').click();
 await expect(page.locator('#status')).toContainText('Sample download failed (404)');await expect(page.locator('#busy')).toBeHidden();await expect(page.locator('#drop')).toBeEnabled();
});

test('downloads and guide links work on a narrow viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.getByRole('link',{name:'Downloads & guide'}).click();
 await expect(page.getByRole('heading',{name:'Pattern / laser',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Read the step-by-step user guide'}).click();await expect(page.getByRole('heading',{level:1})).toContainText('step-by-step user guide');
 await page.getByRole('link',{name:'Open the utility'}).click();await expect(page.locator('#drop')).toBeEnabled();
});

test('standalone HTML opens from file and imports its embedded sample without HTTP',async({page})=>{
 test.skip(!!process.env.PLAYWRIGHT_SKIP_FILE_URL,'Managed Chromium blocks file URLs by administrator policy; this case runs in CI.');
 const external=[];await page.route(/^https?:/,route=>{external.push(route.request().url());return route.abort();});
 await page.goto(new URL('_site/standalone/Pattern_Laser_Utility.html',repository).href);await expect(page.locator('#drop')).toBeEnabled();
 await page.locator('#sample').click();await expect(page.locator('#fileName')).toHaveText('CARD HOLDER YOMMY.pdf');await expect(page.locator('#busy')).toBeHidden();
 expect(await page.locator('#paper .geom').count()).toBeGreaterThan(400);expect(external).toEqual([]);
});


test('standalone HTML keeps working after the browser goes offline',async({page,context})=>{
 await page.goto('standalone/Pattern_Laser_Utility.html');await expect(page.locator('#drop')).toBeEnabled();
 await context.setOffline(true);await page.locator('#sample').click();
 await expect(page.locator('#fileName')).toHaveText('CARD HOLDER YOMMY.pdf');await expect(page.locator('#busy')).toBeHidden();
 expect(await page.locator('#paper .geom').count()).toBeGreaterThan(400);
});

test('physical calibration changes SVG dimensions uniformly',async({page},testInfo)=>{
 await selectionProject(page);await page.locator('#known').fill('25.4');await page.locator('#measured').fill('25');await page.locator('#calibrate').click();
 await expect(page.locator('#scaleLabel')).toHaveText('101.600%');
 const {text}=await downloadText(page,testInfo,()=>page.locator('#export').click());
 expect(text).toContain('width="121.92mm"');expect(text).toContain('height="101.6mm"');
 await page.locator('#resetScale').click();await expect(page.locator('#scaleLabel')).toHaveText('100.000%');
});

test('Measure uses two clicks without starting box selection',async({page})=>{
 await selectionProject(page);await page.locator('#measureTool').click();
 for(const coords of [[20,20],[30,20]]){const p=await point(page,...coords);await page.mouse.click(p.x,p.y);}
 await expect.poll(async()=>Math.abs(Number(await page.locator('#measured').inputValue())-10)).toBeLessThan(.25);await expect(page.locator('#selectedCount')).toHaveText('0 SELECTED');
 await page.locator('#selectTool').click();await drag(page,[18,18],[35,25]);await expect(page.locator('#selectedCount')).toHaveText('2 SELECTED');
});

test('preview visibility does not omit holes; export inclusion does',async({page},testInfo)=>{
 await reviewedProject(page);await page.getByRole('checkbox',{name:'Show Stitch holes',exact:true}).uncheck();
 await expect(page.locator('#paper .geom')).toHaveCount(6);
 const visibleOnly=await downloadText(page,testInfo,()=>page.locator('#export').click());expect(visibleOnly.text).toContain('<g id="holes"');
 await page.locator('#exportLayers input[value="holes"]').uncheck();await expect(page.locator('#exportInventory')).toContainText('Stitch holes: 0 included / 438 total');
 const omitted=await downloadText(page,testInfo,()=>page.locator('#export').click());expect(omitted.text).not.toContain('<g id="holes"');expect(omitted.text).toContain('<g id="cut"');
});
