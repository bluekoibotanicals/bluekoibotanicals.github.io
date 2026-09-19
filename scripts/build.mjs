import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const candidates=process.platform==='win32'?[['py',['-3']],['python',[]]]:[['python3',[]],['python',[]]];
for(const [command,args] of candidates){
  const result=spawnSync(command,[...args,'scripts/build_site.py'],{cwd:root,stdio:'inherit',env:{...process.env,PYTHONUTF8:'1'}});
  if(result.error?.code==='ENOENT')continue;
  if(result.error)console.error(result.error.message);
  process.exit(result.status ?? 1);
}
console.error('Python 3 is required to build the website. Install it, then reopen your terminal.');
process.exit(1);
