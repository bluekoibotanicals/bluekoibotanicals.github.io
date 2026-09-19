// Development/test adapter only. Production uses Cloudflare D1.
import {DatabaseSync} from 'node:sqlite';
export class LocalDB {
  constructor(file=':memory:'){this.db=new DatabaseSync(file);}
  exec(sql){this.db.exec(sql);}
  prepare(sql){return new Statement(this,sql);}
  async batch(statements){this.db.exec('BEGIN');try{const results=statements.map(s=>s.execute());this.db.exec('COMMIT');return results;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  close(){this.db.close();}
}
class Statement {
  constructor(db,sql,values=[]){this.db=db;this.sql=sql;this.values=values;}
  bind(...values){return new Statement(this.db,this.sql,values);}
  execute(){const result=this.db.db.prepare(this.sql).run(...this.values);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}
  async run(){return this.execute();}
  async all(){return {results:this.db.db.prepare(this.sql).all(...this.values)};}
  async first(){return this.db.db.prepare(this.sql).get(...this.values) || null;}
}
