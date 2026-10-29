/** A failed page never becomes a plausible partial total. */
export async function readAllRows(query: any, maximum=100000): Promise<{data:any[];error:any}> {
 const rows:any[]=[];
 for(let offset=0;offset<maximum;offset+=500){
  const page=await query.order('id').range(offset,offset+499);
  if(page.error)return {data:[],error:page.error};
  rows.push(...(page.data??[]));
  if((page.data??[]).length<500)return {data:rows,error:null};
 }
 return {data:[],error:{message:'A consulta excedeu o limite seguro. Refine os filtros.'}};
}
