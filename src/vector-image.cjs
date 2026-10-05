const {execFile}=require('node:child_process');
const path=require('node:path');
// Failure to obtain a vector always falls back to the original image, never a redraw of the equation.
async function renderVector(source='') {
 if(process.platform!=='win32')return null;
 if(/\.(wmz|emz)$/i.test(source)){
  const fs=require('node:fs/promises'),zlib=require('node:zlib');let temporary;
  try{const bytes=await fs.readFile(source);if(bytes.length>40*1024*1024)return null;const unpacked=zlib.gunzipSync(bytes,{maxOutputLength:40*1024*1024});temporary=path.join(require('node:os').tmpdir(),'chengjian-vector-'+require('node:crypto').randomUUID()+(/\.wmz$/i.test(source)?'.wmf':'.emf'));await fs.writeFile(temporary,unpacked);return await renderVector(temporary);}catch{return null;}finally{if(temporary)await fs.unlink(temporary).catch(()=>{});}
 }
 return new Promise(resolve=>{
  const exe=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const script=path.join(__dirname,'vector-image.ps1').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep);
  execFile(exe,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Source',source],{windowsHide:true,timeout:8000,maxBuffer:24*1024*1024},(error,out)=>{
   try{if(error)return resolve(null);const data=JSON.parse(out.trim());if(!data.png||!Number.isFinite(data.width))return resolve(null);resolve({...data,bytes:Buffer.from(data.png,'base64')});}catch{resolve(null);}
  });
 });
}
module.exports={renderVector};
