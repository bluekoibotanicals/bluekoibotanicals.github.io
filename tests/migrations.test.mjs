import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LocalDB} from '../scripts/local-db.mjs';
test('notification migration preserves existing orders and initializes new fields',async()=>{
  const db=new LocalDB();
  try{
    db.exec(readFileSync(new URL('../migrations/0001_store.sql',import.meta.url),'utf8'));
    await db.prepare("INSERT INTO orders(id,quote_id,session_hash,status,data,created_at,updated_at,email_sent) VALUES('old','quote','session','paid','{}',1,1,1)").run();
    db.exec(readFileSync(new URL('../migrations/0002_recovery_notifications.sql',import.meta.url),'utf8'));
    const row=await db.prepare("SELECT * FROM orders WHERE id='old'").first();
    assert.equal(row.status,'paid');assert.equal(row.email_sent,1);assert.equal(row.owner_email_sent,0);assert.equal(row.recovery_checked_at,0);assert.equal(row.recovery_note,null);
  }finally{db.close();}
});
