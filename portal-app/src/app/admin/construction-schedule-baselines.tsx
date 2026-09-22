import React, {useEffect, useState} from 'react';
import {Text} from 'react-native';
import {AdminPageHeader} from '@/components/admin-ui';
import {Button, Card, Notice, Screen, StateView} from '@/components/ui';
import {listConstructionScheduleBaselines, type ScheduleBaselineArchive} from '@/services/construction-schedule-baseline-service';

export default function ConstructionScheduleBaselinesScreen() {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ScheduleBaselineArchive[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let mounted = true;
    const task = setTimeout(() => {
      if (!mounted) return;
      setLoading(true);
      void listConstructionScheduleBaselines(page).then((result) => {
        if (!mounted) return;
        setRows(result.data); setTotal(result.total); setError(result.error);
        setSelected(null); setLoading(false);
      });
    }, 0);
    return () => {mounted = false; clearTimeout(task);};
  }, [page, refresh]);
  return <Screen>
    <AdminPageHeader title="Arquivo de linhas de base" description="Versões aprovadas preservadas, somente consulta administrativa; não é uma tela de aditivos." />
    <Notice tone="info">Nenhuma consulta altera uma versão. Um aditivo e sua reprogramação precisam ser vinculados e aprovados separadamente antes de se tornarem vigentes.</Notice>
    {error ? <Notice tone="danger">{error}</Notice> : null}
    {!loading && !error && rows.length === 0 ?
      <StateView title="Nenhuma linha de base arquivada" description="Uma linha de base entra no arquivo após aprovação; planos antigos não são aprovados automaticamente." icon="archive-outline" /> : null}
    {rows.map((row) => <Card key={row.id}>
      <Text>Contrato: {row.contractNumber ?? 'Número não disponível'} • linha de base v{row.version}</Text>
      <Text>ID do cronograma: {row.scheduleId}</Text>
      <Text>Aprovada: {row.approvedAt ? row.approvedAt.slice(0, 10) : 'Data não informada'} • arquivada: {row.archivedAt.slice(0, 10)}</Text>
      <Text>{row.activities.length} atividade(s) • {row.holidays.length} feriado(s) conferido(s) e congelado(s)</Text>
      <Button title={selected === row.id ? 'Ocultar planejamento' : 'Conferir atividades e feriados arquivados'} variant="secondary" onPress={() => setSelected((current) => current === row.id ? null : row.id)} />
      {selected === row.id ? <>
        {row.activities.map((activity, index) =>
          <Text key={`${row.id}:${activity.code}:${index}`}>{activity.code} — {activity.activity} • {activity.start ?? 'Sem início'} a {activity.finish ?? 'Sem término'}</Text>)}
        <Text>Feriados e datas não úteis aprovados: {row.holidays.length ? row.holidays.join(', ') : 'Nenhuma data informada'}</Text>
      </> : null}
    </Card>)}
    <Text>{total === 0 ? 0 : page * 50 + 1}–{page * 50 + rows.length} de {total} versão(ões) arquivada(s)</Text>
    <Button title="Página anterior" variant="secondary" disabled={page === 0 || loading} onPress={() => setPage((current) => Math.max(0, current - 1))} />
    <Button title="Próxima página" variant="secondary" disabled={loading || (page + 1) * 50 >= total} onPress={() => setPage((current) => current + 1)} />
    <Button title="Atualizar histórico" variant="ghost" disabled={loading} onPress={() => setRefresh((current) => current + 1)} />
  </Screen>;
}
