// Keep a real, attached download link available until the user closes or replaces it.
// Embedded browsers may block downloads; opening the file or copying its text remain available.
export function createDownloadManager({document,window,navigator,URL,Blob}) {
 const $=id=>document.getElementById(id);
 let active=null;
 const message=s=>{$('downloadStatus').textContent=s;};
 function prepare(name,content,type='image/svg+xml') {
  if(active)URL.revokeObjectURL(active.url);
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob);
  active={name,content,type,blob,url};
  $('downloadName').textContent=name;
  $('downloadContents').value=content;
  const link=$('downloadSaveLink');link.href=url;link.download=name;
  $('downloadOpenLink').href=url;
  $('downloadNativeSave').hidden=!(window.showSaveFilePicker&&window.isSecureContext&&window.self===window.top);
  message('Your file is ready. Click Download file. If downloads are blocked in this view, use Open file, Copy contents, or open the utility in a browser tab.');
  const dialog=$('downloadDialog');if(!dialog.open)dialog.showModal();
  return active;
 }
 async function saveAs(){
  if(!active)return;
  const file=active,extension='.'+file.name.split('.').pop();
  try{
   const handle=await window.showSaveFilePicker({suggestedName:file.name,types:[{description:extension==='.svg'?'SVG image':'JSON file',accept:{[file.type.split(';')[0]]:[extension]}}]});
   const writable=await handle.createWritable();await writable.write(file.blob);await writable.close();
   if(active===file)message('Saved '+file.name+'.');
  }catch(e){
   if(e.name==='AbortError')message('Save cancelled. Your file is still available here.');
   else message('This browser could not open Save as. Use Download file, Open file, or Copy contents instead.');
  }
 }
 async function copy(){
  if(!active)return;
  try{await navigator.clipboard.writeText(active.content);message('File contents copied. Paste into a text editor and save as '+active.name+'.');}
  catch{
   $('downloadSource').open=true;const area=$('downloadContents');area.focus();area.select();
   let copied=false;try{copied=document.execCommand('copy');}catch{}
   message(copied?'File contents copied. Save them as '+active.name+'.':'Contents selected. Press Ctrl+C (Mac: ⌘C), then paste into a text editor and save as '+active.name+'.');
  }
 }
 $('downloadNativeSave').onclick=saveAs;
 $('downloadCopy').onclick=copy;
 $('downloadSaveLink').onclick=()=>message('Download requested. If no file appears in your Downloads folder, use Open file and save it there, or open the utility in a browser tab.');
 $('downloadOpenLink').onclick=()=>message('Opening the file in a new tab. Use the browser’s Save page as command and keep the suggested file extension.');
 $('downloadClose').onclick=()=>$('downloadDialog').close();
 return {prepare,saveAs,copy};
}
