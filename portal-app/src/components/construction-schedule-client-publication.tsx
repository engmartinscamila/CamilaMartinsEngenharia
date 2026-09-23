import React, {useEffect, useState} from 'react';
import {Text} from 'react-native';
import {Button, Card, Field, Notice} from '@/components/ui';
import {
  adminGetCurrentConstructionPublication, adminPublishConstructionSchedule, adminRevokeConstructionSchedule,
} from '@/services/construction-schedule-publication-service';

interface Props {scheduleId:string;projectId:string;}
export function ConstructionScheduleClientPublication({scheduleId,projectId}:Props) {
  const [publicationId,setPublicationId]=useState<string|null>(null);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [success,setSuccess]=useState<string|null>(null);
  useEffect(()=>{
    let active=true;
    void adminGetCurrentConstructionPublication(projectId).then((result)=>{
      if(!active)return;
      setPublicationId(result.id);setError(result.error);
    });
    return ()=>{active=false;};
  },[projectId]);
  const publish=async()=>{
    if(busy)return;
    setBusy(true);setError(null);setSuccess(null);
    const failure=await adminPublishConstructionSchedule(scheduleId);
    if(failure) setError(failure);
    else {
      const current=await adminGetCurrentConstructionPublication(projectId);
      setPublicationId(current.id);
      if(current.error)setError(current.error);
      else setSuccess('Resumo do cronograma publicado somente para o cliente deste projeto, se o módulo estiver liberado. Custos e documentos comerciais não são publicados.');
    }
    setBusy(false);
  };
  const revoke=async()=>{
    if(!publicationId||busy)return;
    setBusy(true);setError(null);setSuccess(null);
    const failure=await adminRevokeConstructionSchedule(publicationId,reason);
    if(failure)setError(failure);
    else {setPublicationId(null);setReason('');setSuccess('A publicação foi revogada. O histórico de publicações foi preservado.');}
    setBusy(false);
  };
  return <Card>
    <Text>Publicação no portal do cliente</Text>
    <Notice tone="info">Publicação opcional e expressa: exige linha de base aprovada e módulo Cronograma habilitado. O cliente recebe apenas atividades, datas e percentuais que tenham medição datada. Honorários, custos da obra e notas internas permanecem restritos à administração.</Notice>
    {error?<Notice tone="danger">{error}</Notice>:null}
    {success?<Notice tone="success">{success}</Notice>:null}
    <Text>{publicationId?'Resumo publicado — atualize somente após revisar os dados.':'Nenhum resumo publicado para este projeto.'}</Text>
    <Button title={publicationId?'Revisar e republicar resumo do cliente':'Publicar resumo revisado para o cliente'} loading={busy} disabled={busy} onPress={()=>void publish()}/>
    {publicationId?<>
      <Field label="Motivo para retirar publicação (mínimo de dez caracteres)" value={reason} onChangeText={setReason}/>
      <Button title="Retirar publicação, preservando histórico" variant="secondary" loading={busy} disabled={busy||reason.trim().length<10} onPress={()=>void revoke()}/>
    </>:null}
  </Card>;
}
