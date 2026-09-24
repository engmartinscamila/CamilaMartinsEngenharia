import { createClient } from 'supabase';
import ExcelJS from 'npm:exceljs@4.4.0';
import { Buffer } from 'node:buffer';

const corsHeaders={
  'Access-Control-Allow-Origin':Deno.env.get('ALLOWED_ORIGIN')??'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8'}});
const iso=(value:unknown)=>/^\d{4}-\d{2}-\d{2}$/.test(String(value??''))?String(value):null;
const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):null;
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({generated:false,error:'Método não permitido.'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL');
    const anon=Deno.env.get('SUPABASE_ANON_KEY');
    const auth=req.headers.get('Authorization');
    if(!url||!anon||!auth?.startsWith('Bearer '))return json({generated:false,error:'Sessão ausente.'},401);
    const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await caller.auth.getUser();
    if(userError||!userData.user)return json({generated:false,error:'Sessão inválida.'},401);
    const {data:isAdmin,error:adminError}=await caller.rpc('is_portal_admin');
    if(adminError||isAdmin!==true)return json({generated:false,error:'Acesso administrativo necessário.'},403);

    const body=await req.json().catch(()=>({}));
    if(body.testMode!==true)return json({generated:false,error:'Este endpoint aceita somente o modo TESTE / NÃO CONTRATUAL.'},400);
    const startDate=iso(body.startDate),finishDate=iso(body.finishDate);
    const revision=Math.max(1,Math.min(999,Math.trunc(number(body.revision)??1)));
    const calendar=body.calendar==='calendar_days'?'Dias corridos':'Dias úteis';
    const sourceItems=Array.isArray(body.items)?body.items:[];
    if(!startDate||!finishDate||sourceItems.length<1||sourceItems.length>200)return json({generated:false,error:'Plano de teste inválido ou vazio.'},400);

    const items=sourceItems.map((raw:any,index:number)=>{
      const duration=Math.trunc(number(raw.durationDays)??0);
      const cost=number(raw.plannedCost)??0;
      const weight=number(raw.weightPercent)??0;
      const progress=clamp(number(raw.actualProgress)??0);
      if(duration<1||duration>3660||cost<0||weight<0||weight>100)throw new Error(`Atividade ${index+1} possui dados inválidos.`);
      return {
        code:String(raw.code??`T${index+1}`).slice(0,30),
        activity:String(raw.activity??'Atividade de teste').slice(0,300),
        predecessorCode:raw.predecessorCode?String(raw.predecessorCode).slice(0,30):'',
        plannedStart:iso(raw.plannedStart),
        plannedFinish:iso(raw.plannedFinish),
        durationDays:duration,
        plannedCost:cost,
        weightPercent:weight,
        quantity:number(raw.quantity),
        unit:raw.unit?String(raw.unit).slice(0,30):'',
        unitCost:number(raw.unitCost),
        actualProgress:progress,
      };
    });
    if(items.some((item:any)=>!item.plannedStart||!item.plannedFinish))return json({generated:false,error:'Todas as atividades precisam de datas calculadas válidas.'},400);

    const workbook=new ExcelJS.Workbook();
    workbook.creator='Camila Martins Engenharia Civil';
    workbook.company='Camila Martins Engenharia Civil';
    workbook.subject='Cronograma de teste não contratual';
    const navy='08192B',gold='C39C54',red='B42318',line='D5DADF';
    const titleFill:any={type:'pattern',pattern:'solid',fgColor:{argb:navy}};
    const headerFill:any={type:'pattern',pattern:'solid',fgColor:{argb:gold}};
    const border:any={style:'thin',color:{argb:line}};
    const stamp=(sheet:any)=>{
      sheet.mergeCells('A1:H2');
      sheet.getCell('A1').value='TESTE / NÃO CONTRATUAL — NÃO ENVIAR AO CLIENTE';
      sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:red}};
      sheet.getCell('A1').font={bold:true,size:16,color:{argb:'FFFFFF'}};
      sheet.getCell('A1').alignment={horizontal:'center',vertical:'middle'};
    };

    const resumo=workbook.addWorksheet('TESTE - Resumo',{views:[{showGridLines:false}]});
    stamp(resumo);
    resumo.addRows([
      [],['Identificação','Cronograma isolado de teste'],['Revisão',revision],['Início',startDate],['Fim',finishDate],
      ['Calendário',calendar],['Atividades',items.length],['Custo total',items.reduce((sum:any,item:any)=>sum+item.plannedCost,0)],
      ['Progresso ponderado (%)',items.reduce((sum:any,item:any)=>sum+item.weightPercent*item.actualProgress/100,0)],
      ['Observação',String(body.notes??'Dados fictícios; nenhuma informação foi gravada em projeto, contrato, aceite, faturamento ou linha de base.')],
    ]);
    resumo.getColumn(1).width=28;resumo.getColumn(2).width=70;resumo.getCell('A4').font={bold:true};

    const cron=workbook.addWorksheet('Cronograma TESTE',{views:[{state:'frozen',ySplit:4,showGridLines:false}]});
    stamp(cron);
    const headers=['Código','Atividade','Predecessora','Início','Fim','Duração (dias)','Peso (%)','Custo (R$)','Progresso TESTE (%)','Real ponderado'];
    cron.addRow([]);cron.addRow(headers);cron.getRow(4).fill=headerFill;cron.getRow(4).font={bold:true,color:{argb:navy}};
    items.forEach((item:any,index:number)=>{
      const row=cron.addRow([item.code,item.activity,item.predecessorCode,item.plannedStart,item.plannedFinish,item.durationDays,item.weightPercent,item.plannedCost,item.actualProgress,{formula:`G${index+5}*I${index+5}/100`}]);
      for(let col=1;col<=10;col++)row.getCell(col).border={top:border,bottom:border,left:border,right:border};
      row.getCell(8).numFmt='R$ #,##0.00';row.getCell(7).numFmt='0.00"%"';row.getCell(9).numFmt='0.00"%"';row.getCell(10).numFmt='0.00"%"';
    });
    [12,42,14,14,14,14,12,16,20,18].forEach((width,index)=>cron.getColumn(index+1).width=width);

    const med=workbook.addWorksheet('Medições TESTE',{views:[{showGridLines:false}]});stamp(med);med.addRow([]);med.addRow(['Código','Atividade','Progresso TESTE (%)','Valor planejado','Valor medido TESTE','Observação']);
    med.getRow(4).fill=headerFill;med.getRow(4).font={bold:true,color:{argb:navy}};
    items.forEach((item:any)=>{const row=med.addRow([item.code,item.activity,item.actualProgress,item.plannedCost,item.plannedCost*item.actualProgress/100,'Simulação sem efeito contratual']);row.getCell(3).numFmt='0.00"%"';row.getCell(4).numFmt='R$ #,##0.00';row.getCell(5).numFmt='R$ #,##0.00';});

    const qtd=workbook.addWorksheet('Quantitativos TESTE',{views:[{showGridLines:false}]});stamp(qtd);qtd.addRow([]);qtd.addRow(['Código','Atividade','Quantidade','Unidade','Preço unitário TESTE','Custo planejado']);
    qtd.getRow(4).fill=headerFill;qtd.getRow(4).font={bold:true,color:{argb:navy}};
    items.forEach((item:any)=>{const row=qtd.addRow([item.code,item.activity,item.quantity??'',item.unit,item.unitCost??'',item.plannedCost]);row.getCell(5).numFmt='R$ #,##0.00';row.getCell(6).numFmt='R$ #,##0.00';});

    const start=new Date(`${startDate}T12:00:00Z`);
    const finish=new Date(`${finishDate}T12:00:00Z`);
    const span=Math.max(1,Math.ceil((finish.getTime()-start.getTime())/86400000)+1);
    const periods=Array.from({length:Math.min(span,120)},(_,index)=>new Date(start.getTime()+Math.round(index*Math.max(1,span-1)/Math.max(1,Math.min(span,120)-1))*86400000));

    const gantt=workbook.addWorksheet('Gantt TESTE',{views:[{state:'frozen',xSplit:2,ySplit:4,showGridLines:false}]});stamp(gantt);gantt.addRow([]);gantt.addRow(['Código','Atividade',...periods]);
    gantt.getRow(4).fill=headerFill;gantt.getRow(4).font={bold:true,color:{argb:navy}};
    periods.forEach((date,index)=>{gantt.getCell(4,index+3).value=date;gantt.getCell(4,index+3).numFmt='dd/mm';gantt.getColumn(index+3).width=4;});
    items.forEach((item:any)=>{
      const row=gantt.addRow([item.code,item.activity,...periods.map((date)=>{const d=date.toISOString().slice(0,10);return d>=item.plannedStart&&d<=item.plannedFinish?'■':'';})]);
      for(let col=3;col<=periods.length+2;col++){row.getCell(col).font={bold:true,color:{argb:gold}};row.getCell(col).alignment={horizontal:'center'};}
    });
    gantt.getColumn(1).width=12;gantt.getColumn(2).width=42;

    const curve=workbook.addWorksheet('Curva S TESTE',{views:[{showGridLines:false}]});stamp(curve);curve.addRow([]);curve.addRow(['Data','Planejado acumulado (%)','Real simulado (%)']);
    curve.getRow(4).fill=headerFill;curve.getRow(4).font={bold:true,color:{argb:navy}};
    periods.forEach((date)=>{
      const dateIso=date.toISOString().slice(0,10);
      const planned=items.reduce((sum:any,item:any)=>{
        if(dateIso<item.plannedStart)return sum;
        if(dateIso>=item.plannedFinish)return sum+item.weightPercent;
        const a=new Date(`${item.plannedStart}T12:00:00Z`),b=new Date(`${item.plannedFinish}T12:00:00Z`);
        return sum+item.weightPercent*clamp((date.getTime()-a.getTime())/Math.max(1,b.getTime()-a.getTime())*100)/100;
      },0);
      const real=items.reduce((sum:any,item:any)=>sum+item.weightPercent*item.actualProgress/100,0);
      const row=curve.addRow([date,planned,real]);row.getCell(1).numFmt='dd/mm/yyyy';row.getCell(2).numFmt='0.00"%"';row.getCell(3).numFmt='0.00"%"';
    });
    curve.getColumn(1).width=18;curve.getColumn(2).width=26;curve.getColumn(3).width=24;

    const bytes=await workbook.xlsx.writeBuffer();
    return json({
      generated:true,
      fileName:`Cronograma-TESTE-NAO-CONTRATUAL-r${revision}.xlsx`,
      contentBase64:Buffer.from(bytes as ArrayBuffer).toString('base64'),
      itemCount:items.length,
      testMode:true,
      persisted:false,
    });
  }catch(error){
    console.error('generate-construction-schedule-test-xlsx',error);
    return json({generated:false,error:error instanceof Error?error.message:'Falha ao gerar Excel de teste.'},500);
  }
});
