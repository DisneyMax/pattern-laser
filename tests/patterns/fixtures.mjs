// Original, generated fixture geometry. No third-party artwork is embedded.
import {deflateSync} from 'node:zlib';
const PT=72/25.4;
const n=value=>Number(value.toFixed(7));
const stream=(dictionary,data)=>Buffer.concat([Buffer.from(dictionary+` /Length ${data.length} >>\nstream\n`),data,Buffer.from('\nendstream')]);
export function pdfDocument(pages){
 const objects=[Buffer.alloc(0),Buffer.alloc(0)],kids=[];
 for(const page of pages){
  const id=objects.length+1;kids.push(`${id} 0 R`);objects.push(Buffer.alloc(0));
  const contentId=objects.length+1;objects.push(stream('<<',Buffer.from(page.content)));
  const resources=[];
  for(const [name,image]of Object.entries(page.images||{})){
   const imageId=objects.length+1;resources.push(`/${name} ${imageId} 0 R`);
   objects.push(stream(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,deflateSync(image.pixels)));
  }
  const extra=(page.rotate?` /Rotate ${page.rotate}`:'')+(page.crop?` /CropBox [${page.crop.map(x=>n(x*PT)).join(' ')}]`:'');
  objects[id-1]=Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(page.width*PT)} ${n(page.height*PT)}]${extra} /Resources << /XObject << ${resources.join(' ')} >> >> /Contents ${contentId} 0 R >>`);
 }
 objects[0]=Buffer.from('<< /Type /Catalog /Pages 2 0 R >>');objects[1]=Buffer.from(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`);
 const chunks=[Buffer.from('%PDF-1.4\n')],offsets=[];let size=chunks[0].length;
 for(let i=0;i<objects.length;i++){offsets.push(size);const chunk=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),objects[i],Buffer.from('\nendobj\n')]);chunks.push(chunk);size+=chunk.length;}
 chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF`));
 return Buffer.concat(chunks);
}
const topLeft=(height,body)=>`q ${n(PT)} 0 0 ${n(-PT)} 0 ${n(height*PT)} cm 0 G 0 g 0.1 w\n${body}\nQ`;
const rect=(x,y,w,h)=>`${x} ${y} ${w} ${h} re S`;
function circle(x,y,r,paint='f'){
 const k=r*.5522847498;
 return `${n(x+r)} ${y} m ${n(x+r)} ${n(y+k)} ${n(x+k)} ${n(y+r)} ${x} ${n(y+r)} c ${n(x-k)} ${n(y+r)} ${n(x-r)} ${n(y+k)} ${n(x-r)} ${y} c ${n(x-r)} ${n(y-k)} ${n(x-k)} ${n(y-r)} ${x} ${n(y-r)} c ${n(x+k)} ${n(y-r)} ${n(x+r)} ${n(y-k)} ${n(x+r)} ${y} c h ${paint}`;
}
export function vectorPattern({format='a4',duplicate=false,gray=false}={}){
 const [width,height]=format==='letter'?[215.9,279.4]:[210,297];
 const body=[rect(20,40,80,50),...(duplicate?[rect(20,40,80,50)]:[]),'0.38 g',...Array.from({length:12},(_,i)=>circle(24+i*4,44,.5)),'0 g',circle(85,75,1.2,'S'),rect(55,65,6,12),rect(120,40,25.4,25.4)];
 if(!gray)body[duplicate?2:1]='0 g';
 return pdfDocument([{width,height,content:topLeft(height,body.join('\n'))}]);
}
export function transformedPattern(){
 return pdfDocument([
  {width:210,height:297,content:topLeft(297,'q 0 1 -1 0 130 40 cm '+rect(10,10,40,20)+' Q')},
  {width:210,height:297,rotate:90,content:topLeft(297,rect(20,30,80,40))},
  {width:210,height:297,crop:[10,20,190,270],content:topLeft(297,rect(30,50,80,40))},
 ]);
}
export function clippedPattern(){
 return pdfDocument([{width:120,height:100,content:topLeft(100,'q 10 10 60 40 re W n '+[rect(20,20,30,20),rect(60,20,30,20),rect(100,20,10,20)].join('\n')+' Q')}]);
}
export function branchedPattern(){
 return pdfDocument([{width:160,height:100,content:topLeft(100,'10 20 m 50 20 l 50 60 l 10 60 l 10 20.08 l S\n90 20 m 110 20 l 110 40 l S\n110 40 m 90 40 l 90 20.04 l S\n110 40 m 115 45 l S')}]);
}
export function rasterPattern(){
 const width=600,height=600,pixels=Buffer.alloc(width*height,255);
 const pixel=(x,y,value=0)=>{const index=y*width+x;pixels[index]=Math.min(pixels[index],value);};
 const outline=(x,y,w,h,thickness=3,value=0)=>{for(let t=0;t<thickness;t++){for(let xx=x;xx<=x+w;xx++){pixel(xx,y+t,value);pixel(xx,y+h-t,value);}for(let yy=y;yy<=y+h;yy++){pixel(x+t,yy,value);pixel(x+w-t,yy,value);}}};
 outline(10,10,580,580,3,225);outline(50,50,200,150);outline(320,50,180,150);outline(50,300,400,200);
 for(const [start,end]of [[80,230],[335,485]])for(let x=start;x<=end;x+=30)for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++)if(xx*xx+yy*yy<=4)pixel(x+xx,85+yy);
 return pdfDocument([{width:120,height:120,images:{Pattern:{width,height,pixels}},content:`q ${n(120*PT)} 0 0 ${n(120*PT)} 0 0 cm /Pattern Do Q`}]);
}
