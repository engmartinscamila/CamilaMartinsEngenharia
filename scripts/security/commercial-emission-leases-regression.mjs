import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table public.commercial_records(id uuid primary key);grant select on public.commercial_records to service_role;');
 await db.query('insert into commercial_records values($1),($2)',[id(1),id(2)]);
 const migrations=process.env.CME_EMISSION_LEASE_MIGRATION?[process.env.CME_EMISSION_LEASE_MIGRATION]:fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('_commercial_emission_leases.sql')).sort().map(n=>'supabase/migrations/'+n);
 assert.ok(migrations.length,'Migration for the real lease functions must exist');
 for(const migration of migrations)await db.exec(fs.readFileSync(migration,'utf8'));
 const claim=async(record,kind,lane,token,parent=null)=>(await db.query('select public.service_acquire_commercial_emission($1,$2,$3,$4,$5) ok',[record,kind,lane,token,parent])).rows[0].ok;
 const release=async(record,kind,lane,token)=>(await db.query('select public.service_release_commercial_emission($1,$2,$3,$4) ok',[record,kind,lane,token])).rows[0].ok;
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query("select has_function_privilege($1,'public.service_acquire_commercial_emission(uuid,text,text,uuid,uuid)','execute') allowed",[role])).rows[0].allowed,false);
  assert.equal((await db.query("select has_table_privilege($1,'private.commercial_emission_leases','select') allowed",[role])).rows[0].allowed,false);
 }
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='private.commercial_emission_leases'::regclass")).rows[0].relrowsecurity,true);
 await db.exec('set role service_role');
 assert.deepEqual(await Promise.all([claim(id(1),'contrato','finalizer',id(10)),claim(id(1),'contrato','finalizer',id(11))]),[true,false]);
 assert.equal(await claim(id(1),'contrato','core',id(20),id(11)),false,'A losing parent cannot dispatch a core');
 assert.equal(await claim(id(1),'contrato','core',id(20),id(10)),true);
 assert.equal(await claim(id(1),'contrato','core',id(21),id(10)),false,'Only one core may render');
 assert.equal(await release(id(1),'contrato','finalizer',id(10)),true);
 assert.equal(await claim(id(1),'contrato','finalizer',id(11)),false,'Transport failure must not free a live core');
 assert.equal(await claim(id(2),'contrato','finalizer',id(30)),true,'Another record is independent');
 assert.equal(await claim(id(1),'orcamento','finalizer',id(31)),true,'Another document kind is independent');
 assert.equal(await release(id(1),'contrato','core',id(99)),false,'A different owner cannot release a core');
 assert.equal(await release(id(1),'contrato','core',id(20)),true);
 assert.equal(await claim(id(1),'contrato','finalizer',id(11)),true);
 assert.equal(await claim(id(1),'contrato','core',id(22),id(10)),false,'A delayed old request must not start after ownership changes');
 assert.equal(await release(id(1),'contrato','finalizer',id(10)),false,'Late cleanup cannot release the new owner');
 assert.equal(await claim(id(1),'contrato','finalizer',id(12)),false);
 await db.exec('reset role');
 await db.query("update private.commercial_emission_leases set lease_until=clock_timestamp()-interval '1 second' where record_id=$1 and document_kind='contrato'",[id(1)]);
 await db.exec('set role service_role');
 assert.equal(await claim(id(1),'contrato','finalizer',id(12)),true,'Expired ownership must be recoverable');
 assert.equal(await release(id(1),'contrato','finalizer',id(11)),false);
 assert.equal(await claim(id(1),'contrato','core',id(23),id(12)),true);
 assert.equal(await release(id(1),'contrato','core',id(23)),true);
 assert.equal(await release(id(1),'contrato','finalizer',id(12)),true);
 console.log('PASS PostgreSQL: exclusive parent/core ownership, two concurrent claims, late requests, expiry, independent records and restricted privileges.');
}finally{await db.close();}
