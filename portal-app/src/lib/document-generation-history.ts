/** A repeated render is an audit event, not a new document version. */
export function groupDocumentGenerations<T extends {id:string;documentId:string|null;version:string|null;generatedAt:string;storageMode:string}>(events:T[]):(T&{generationCount:number})[]{
 const groups=new Map<string,T&{generationCount:number}>();
 for(const event of events){
  // Events without document identity must never collapse by title or client name.
  const key=event.documentId?JSON.stringify([event.documentId,event.version]):JSON.stringify(['event',event.id]);
  const current=groups.get(key);
  if(!current){groups.set(key,{...event,generationCount:1});continue;}
  const latest=event.generatedAt>current.generatedAt?event:current;
  groups.set(key,{...latest,generationCount:current.generationCount+1});
 }
 return [...groups.values()].sort((a,b)=>b.generatedAt.localeCompare(a.generatedAt));
}
