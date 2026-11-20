import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
test('EPD transport works in the actual Cloudflare runtime and rejects redirects',()=>{
  const require=createRequire(import.meta.url);
  const runner=require.resolve('workerd/bin/workerd');
  const config=fileURLToPath(new URL('./epd-runtime/config.capnp',import.meta.url));
  const result=spawnSync(process.execPath,[runner,'test',config],{encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,[result.error?.message,result.stdout,result.stderr].filter(Boolean).join('\n'));
});
