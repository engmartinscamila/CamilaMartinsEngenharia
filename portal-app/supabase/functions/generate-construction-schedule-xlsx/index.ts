import { createClient } from 'supabase';
import ExcelJS from 'npm:exceljs@4.4.0';
import { PNG } from 'npm:pngjs@7.0.0';
import { Buffer } from 'node:buffer';

const corsHeaders={
  'Access-Control-Allow-Origin':Deno.env.get('ALLOWED_ORIGIN')??'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8'}});
const asDate=(value:unknown)=>value?new Date(`${String(value).slice(0,10)}T12:00:00Z`):null;
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));

function plannedProgress(start:Date|null,finish:Date|null,at:Date){
  if(!start||!finish)return 0;
  if(at<start)return 0;
  if(at>=finish)return 100;
  return clamp(((at.getTime()-start.getTime())/Math.max(1,finish.getTime()-start.getTime()))*100);
}
function actualProgressAt(item:any,at:Date,reference:Date){
  const progress=Number(item.actual_progress??0);
  const start=asDate(item.actual_start);
  const finish=asDate(item.actual_finish);
  if(finish&&at>=finish)return 100;
  if(!start||at<start)return 0;
  if(at>=reference)return progress;
  return clamp(progress*((at.getTime()-start.getTime())/Math.max(1,reference.getTime()-start.getTime())));
}
function lineChart(planned:number[],actual:number[]){
  const width=900,height=380,left=55,right=25,top=25,bottom=45;
  const png=new PNG({width,height});
  for(let i=0;i<png.data.length;i+=4){png.data[i]=250;png.data[i+1]=249;png.data[i+2]=246;png.data[i+3]=255;}
  const dot=(x:number,y:number,c:[number,number,number],radius=1)=>{for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const nx=Math.round(x+dx),ny=Math.round(y+dy);if(nx<0||ny<0||nx>=width||ny>=height)continue;const p=(width*ny+nx)<<2;png.data[p]=c[0];png.data[p+1]=c[1];png.data[p+2]=c[2];png.data[p+3]=255;}};
  const line=(x0:number,y0:number,x1:number,y1:number,c:[number,number,number],radius=1)=>{const steps=Math.max(1,Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))));for(let s=0;s<=steps;s++)dot(x0+(x1-x0)*s/steps,y0+(y1-y0)*s/steps,c,radius);};
  const navy:[number,number,number]=[8,25,43],gold:[number,number,number]=[195,156,84],grid:[number,number,number]=[220,223,226];
  line(left,top,left,height-bottom,navy);line(left,height-bottom,width-right,height-bottom,navy);
  for(let p=0;p<=100;p+=20){const y=height-bottom-(p/100)*(height-top-bottom);line(left,y,width-right,y,grid,0);}
  const mapX=(i:number)=>left+(i/Math.max(1,planned.length-1))*(width-left-right);
  const mapY=(v:number)=>height-bottom-clamp(v)/100*(height-top-bottom);
  for(let i=1;i<planned.length;i++){line(mapX(i-1),mapY(planned[i-1]),mapX(i),mapY(planned[i]),gold,2);line(mapX(i-1),mapY(actual[i-1]),mapX(i),mapY(actual[i]),navy,2);}
  return PNG.sync.write(png).toString('base64');
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({generated:false,error:'Método não permitido.'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL');
    const anon=Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const auth=req.headers.get('Authorization');
    if(!url||!anon||!serviceKey||!auth?.startsWith('Bearer '))throw new Error('Configuração ou sessão ausente.');
    const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await caller.auth.getUser();
    if(userError||!userData.user)throw new Error('Sessão inválida.');
    const {data:isAdmin,error:adminError}=await caller.rpc('is_portal_admin');
    if(adminError||isAdmin!==true)throw new Error('Acesso administrativo necessário.');
    const body=await req.json().catch(()=>({}));
    const projectId=String(body.projectId??'');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId))throw new Error('Projeto inválido.');
    const {error:initError}=await caller.rpc('admin_initialize_construction_schedule',{p_project_id:projectId});
    if(initError)throw initError;

    const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:project,error:projectError}=await service.from('projetos').select('id,cliente_id,contract_id,nome,tipo,status,data_inicio,data_fim,numero_contrato,numero_orcamento,area_construida_m2,area_terreno_m2,endereco_obra,numero_obra,complemento_obra,bairro_obra,cidade_obra,estado_obra').eq('id',projectId).single();
    if(projectError||!project)throw new Error('Projeto não encontrado.');
    const [{data:client,error:clientError},{data:schedule,error:scheduleError}]=await Promise.all([
      service.from('clientes').select('id,nome,cpf_cnpj,telefone,email,endereco,cidade,estado,cep').eq('id',project.cliente_id).single(),
      service.from('construction_schedules').select('*').eq('project_id',projectId).single(),
    ]);
    if(clientError||!client||scheduleError||!schedule)throw new Error('Dados do cronograma incompletos.');
    let contract:any=null;
    if(project.contract_id){const result=await service.from('contratos').select('id,contract_number,service_type,status,signed_at,start_date,end_date,contract_value,currency').eq('id',project.contract_id).maybeSingle();contract=result.data??null;}
    const {data:items,error:itemError}=await service.from('construction_schedule_items').select('*').eq('schedule_id',schedule.id).order('display_order',{ascending:true});
    if(itemError||!items?.length)throw new Error('O cronograma não possui atividades.');

    const workbook=new ExcelJS.Workbook();
    workbook.creator='Camila Martins Engenharia Civil';workbook.company='Camila Martins Engenharia Civil';workbook.subject='Cronograma de obra';workbook.calcProperties.fullCalcOnLoad=true;
    const navy='08192B',gold='C39C54',green='E8F5EE',red='FBEAEA';
    const border:any={style:'thin',color:{argb:'D5DADF'}};
    const titleFill:any={type:'pattern',pattern:'solid',fgColor:{argb:navy}};
    const headerFill:any={type:'pattern',pattern:'solid',fgColor:{argb:gold}};

    const resumo=workbook.addWorksheet('Resumo',{views:[{showGridLines:false}]});
    resumo.mergeCells('A1:H2');resumo.getCell('A1').value='CAMILA MARTINS ENGENHARIA CIVIL — CRONOGRAMA DE OBRA';resumo.getCell('A1').font={bold:true,size:16,color:{argb:'FFFFFF'}};resumo.getCell('A1').fill=titleFill;resumo.getCell('A1').alignment={vertical:'middle',horizontal:'center'};
    const address=[project.endereco_obra,project.numero_obra,project.complemento_obra,project.bairro_obra,project.cidade_obra,project.estado_obra].filter(Boolean).join(', ');
    const meta:any[][]=[['Cliente',client.nome??''],['CPF/CNPJ',client.cpf_cnpj??''],['Projeto/Obra',project.nome??''],['Tipo',project.tipo??''],['Contrato',contract?.contract_number??project.numero_contrato??''],['Orçamento',project.numero_orcamento??''],['Endereço da obra',address],['Área construída (m²)',Number(project.area_construida_m2??0)||''],['Área do terreno (m²)',Number(project.area_terreno_m2??0)||''],['Início previsto',asDate(schedule.planned_start)??asDate(project.data_inicio)??''],['Fim previsto',asDate(schedule.planned_finish)??asDate(project.data_fim)??''],['Data de referência',asDate(schedule.reference_date)??new Date()]];
    meta.forEach((row,idx)=>{const r=4+idx;resumo.getCell(r,1).value=row[0];resumo.getCell(r,1).font={bold:true,color:{argb:navy}};resumo.getCell(r,2).value=row[1];resumo.mergeCells(r,2,r,5);resumo.getCell(r,2).alignment={wrapText:true};});
    ['B13','B14','B15'].forEach(ref=>resumo.getCell(ref).numFmt='dd/mm/yyyy');
    resumo.getCell('G4').value='INDICADORES';resumo.getCell('G4').font={bold:true,color:{argb:'FFFFFF'}};resumo.getCell('G4').fill=titleFill;
    const last=items.length+1;
    resumo.getCell('G6').value='Peso total';resumo.getCell('H6').value={formula:`SUM(Cronograma!D2:D${last})`};
    resumo.getCell('G7').value='Planejado';resumo.getCell('H7').value={formula:`SUM(Cronograma!M2:M${last})`};
    resumo.getCell('G8').value='Realizado';resumo.getCell('H8').value={formula:`SUM(Cronograma!N2:N${last})`};
    resumo.getCell('G9').value='Desvio';resumo.getCell('H9').value={formula:'H8-H7'};
    resumo.getCell('G10').value='Custo previsto';resumo.getCell('H10').value={formula:`SUM(Cronograma!P2:P${last})`};
    resumo.getCell('G11').value='Custo realizado';resumo.getCell('H11').value={formula:`SUM(Cronograma!Q2:Q${last})`};
    ['H6','H7','H8'].forEach(ref=>resumo.getCell(ref).numFmt='0.00"%"');resumo.getCell('H9').numFmt='0.00" p.p."';['H10','H11'].forEach(ref=>resumo.getCell(ref).numFmt='R$ #,##0.00');
    for(let r=6;r<=11;r++)for(let c=7;c<=8;c++)resumo.getCell(r,c).border={top:border,bottom:border,left:border,right:border};
    resumo.columns=[{width:23},{width:22},{width:16},{width:16},{width:18},{width:4},{width:21},{width:18}];

    const cron=workbook.addWorksheet('Cronograma',{views:[{state:'frozen',ySplit:1,showGridLines:false}]});
    const headers=['Código','Categoria','Atividade','Peso (%)','Duração (dias)','Predecessora','Início previsto','Fim previsto','Início real','Fim real','Planejado (%)','Realizado (%)','Planejado ponderado','Real ponderado','Desvio (p.p.)','Custo previsto','Custo real','Status','Observações'];
    cron.addRow(headers);cron.getRow(1).font={bold:true,color:{argb:navy}};cron.getRow(1).fill=headerFill;cron.getRow(1).alignment={vertical:'middle',horizontal:'center',wrapText:true};
    items.forEach((item:any,idx:number)=>{const r=idx+2;const vals=[item.code,item.category,item.activity,Number(item.weight_percent??0),Number(item.planned_duration_days??0),item.predecessor_code??'',asDate(item.planned_start),asDate(item.planned_finish),asDate(item.actual_start),asDate(item.actual_finish),null,Number(item.actual_progress??0),null,null,null,item.planned_cost===null?null:Number(item.planned_cost),item.actual_cost===null?null:Number(item.actual_cost),item.status??'Pendente',item.notes??''];vals.forEach((v,c)=>cron.getCell(r,c+1).value=v as any);cron.getCell(r,11).value={formula:`IF(OR(G${r}="",H${r}=""),0,IF(Resumo!$B$15<G${r},0,IF(Resumo!$B$15>=H${r},100,MAX(0,MIN(100,NETWORKDAYS(G${r},Resumo!$B$15)/MAX(1,NETWORKDAYS(G${r},H${r}))*100)))))`};cron.getCell(r,13).value={formula:`D${r}*K${r}/100`};cron.getCell(r,14).value={formula:`D${r}*L${r}/100`};cron.getCell(r,15).value={formula:`N${r}-M${r}`};for(let c=1;c<=19;c++)cron.getCell(r,c).border={top:border,bottom:border,left:border,right:border};[7,8,9,10].forEach(c=>cron.getCell(r,c).numFmt='dd/mm/yyyy');[4,11,12,13,14,15].forEach(c=>cron.getCell(r,c).numFmt='0.00"%"');[16,17].forEach(c=>cron.getCell(r,c).numFmt='R$ #,##0.00');cron.getCell(r,3).alignment={wrapText:true,vertical:'top'};cron.getCell(r,19).alignment={wrapText:true,vertical:'top'};cron.getCell(r,12).dataValidation={type:'whole',operator:'between',showErrorMessage:true,errorTitle:'Percentual inválido',error:'Informe um valor entre 0 e 100.',formulae:[0,100]};});
    const widths=[10,16,38,11,13,13,14,14,14,14,13,13,18,16,14,16,16,15,35];widths.forEach((w,i)=>cron.getColumn(i+1).width=w);cron.autoFilter={from:'A1',to:`S${last}`};
    cron.addConditionalFormatting({ref:`O2:O${last}`,rules:[{type:'cellIs',operator:'lessThan',formulae:['0'],style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:red}},font:{color:{argb:'B42318'}}}},{type:'cellIs',operator:'greaterThanOrEqual',formulae:['0'],style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:green}},font:{color:{argb:'18794E'}}}}] as any});

    const start=asDate(schedule.planned_start)??asDate(project.data_inicio)??new Date();const reference=asDate(schedule.reference_date)??new Date();const periods=Array.from({length:27},(_,i)=>new Date(start.getTime()+i*7*86400000));
    const planned=periods.map(d=>items.reduce((sum:number,item:any)=>sum+Number(item.weight_percent??0)*plannedProgress(asDate(item.planned_start),asDate(item.planned_finish),d)/100,0));
    const actual=periods.map(d=>items.reduce((sum:number,item:any)=>sum+Number(item.weight_percent??0)*actualProgressAt(item,d,reference)/100,0));
    const curva=workbook.addWorksheet('Curva S',{views:[{showGridLines:false}]});curva.addRow(['Data','Planejado acumulado (%)','Real acumulado estimado (%)']);curva.getRow(1).fill=headerFill;curva.getRow(1).font={bold:true,color:{argb:navy}};periods.forEach((d,i)=>{curva.addRow([d,planned[i],actual[i]]);curva.getCell(i+2,1).numFmt='dd/mm/yyyy';curva.getCell(i+2,2).numFmt='0.00"%"';curva.getCell(i+2,3).numFmt='0.00"%"';});curva.columns=[{width:16},{width:24},{width:28}];const imageId=workbook.addImage({base64:lineChart(planned,actual),extension:'png'});curva.addImage(imageId,{tl:{col:4.2,row:1},ext:{width:720,height:305}});curva.getCell('E20').value='Linha dourada: planejado';curva.getCell('E21').value='Linha azul: realizado estimado';

    const gantt=workbook.addWorksheet('Gantt',{views:[{state:'frozen',xSplit:3,ySplit:3,showGridLines:false}]});gantt.getCell('A1').value='GANTT SEMANAL — edite as datas no Cronograma para recalcular as barras';gantt.mergeCells('A1:AD1');gantt.getCell('A1').fill=titleFill;gantt.getCell('A1').font={bold:true,color:{argb:'FFFFFF'}};gantt.getRow(3).values=['Código','Atividade','Peso (%)',...periods];gantt.getRow(3).fill=headerFill;gantt.getRow(3).font={bold:true,color:{argb:navy}};periods.forEach((_,i)=>gantt.getCell(3,4+i).numFmt='dd/mm');items.forEach((item:any,idx:number)=>{const r=idx+4,source=idx+2;gantt.getCell(r,1).value={formula:`Cronograma!A${source}`};gantt.getCell(r,2).value={formula:`Cronograma!C${source}`};gantt.getCell(r,3).value={formula:`Cronograma!D${source}`};gantt.getCell(r,3).numFmt='0.00"%"';periods.forEach((_,p)=>{const col=4+p,letter=gantt.getColumn(col).letter;gantt.getCell(r,col).value={formula:`IF(AND(${letter}$3>=Cronograma!$G${source},${letter}$3<=Cronograma!$H${source}),"■","")`};gantt.getCell(r,col).font={color:{argb:gold},bold:true};gantt.getCell(r,col).alignment={horizontal:'center'};});});gantt.getColumn(1).width=10;gantt.getColumn(2).width=38;gantt.getColumn(3).width=10;for(let c=4;c<=30;c++)gantt.getColumn(c).width=5;

    const params=workbook.addWorksheet('Parâmetros',{views:[{showGridLines:false}]});params.addRows([['Parâmetro','Valor'],['Modelo','Residencial padrão — v1'],['Pesos padrão','Editáveis; total recomendado 100%'],['Percentual realizado','Editar de 0 a 100 na aba Cronograma'],['Datas','Previstas e reais são editáveis'],['Dependências','Use o código da atividade predecessora'],['Planejado × realizado','Calculado por fórmulas'],['Curva S','Atualizada a cada nova exportação'],['Especificidades','Adicionar/editar atividades e observações conforme a obra']]);params.getRow(1).fill=headerFill;params.getRow(1).font={bold:true,color:{argb:navy}};params.getColumn(1).width=28;params.getColumn(2).width=72;

    const bytes=await workbook.xlsx.writeBuffer();const contentBase64=Buffer.from(bytes as ArrayBuffer).toString('base64');const safeName=String(project.nome??'Obra').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/-+/g,'-').slice(0,60)||'Obra';
    return json({generated:true,fileName:`Cronograma-Obra-${safeName}.xlsx`,contentBase64,scheduleId:schedule.id,itemCount:items.length});
  }catch(error){return json({generated:false,error:error instanceof Error?error.message:'Falha ao gerar a planilha.'},400);}
});
