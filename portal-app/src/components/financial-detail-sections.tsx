import React from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Field, Notice, StatusPill } from '@/components/ui';
import { SelectionChips } from '@/components/admin-ui';
import { DateField } from '@/components/date-field';
import { accountBalance, financialToday, type BankTransaction } from '@/lib/financial-model';
import { exportFinancialCsv } from '@/services/financial-tools';
import { formatCurrency, formatDate } from '@/lib/format';
import type { useThemeStyles } from '@/providers/theme-provider';
import type { FinancialAccountSummary, FinancialEntrySummary, FinancialArchiveSummary } from '@/types/domain';

type Styles=ReturnType<typeof useThemeStyles>;
type AsyncAction=()=>Promise<void>;
type Perform=(task:AsyncAction)=>Promise<void>;
export type FinancialAccountSectionProps={
  styles:Styles; referenceAccount:string|null; setReferenceAccount:React.Dispatch<React.SetStateAction<string|null>>;
  accountId:string|null;setAccountId:React.Dispatch<React.SetStateAction<string|null>>;
  accountType:'bank'|'cash'|'credit';setAccountType:React.Dispatch<React.SetStateAction<'bank'|'cash'|'credit'>>;
  accountName:string;setAccountName:React.Dispatch<React.SetStateAction<string>>;
  openingBalance:string;setOpeningBalance:React.Dispatch<React.SetStateAction<string>>;
  openingDate:string;setOpeningDate:React.Dispatch<React.SetStateAction<string>>;
  accounts:FinancialAccountSummary[];transactions:BankTransaction[];entries:FinancialEntrySummary[];
  bankError:string|null;coreError:string|null;importingOfx:boolean;
  perform:Perform;saveAccount:AsyncAction;importOfx:AsyncAction;
};
export function FinancialAccountSection({styles,referenceAccount,setReferenceAccount,accountId,setAccountId,accountType,setAccountType,accountName,setAccountName,openingBalance,setOpeningBalance,openingDate,setOpeningDate,accounts,transactions,entries,bankError,coreError,importingOfx,perform,saveAccount,importOfx}:FinancialAccountSectionProps){
return (
<Card>
          <Text style={styles.sectionTitle}>{referenceAccount?'Conferir referência de saldo':'Contas e saldos'}</Text>
          <SelectionChips label="Conta para importação OFX" value={accountId??''} onChange={value=>setAccountId(value||null)} items={[{value:'',label:'Selecione'},...accounts.map(account=>({value:account.id,label:account.name}))]} />
          {!referenceAccount ? <SelectionChips items={[{ value: 'bank', label: 'Banco' }, { value: 'cash', label: 'Caixa' }, { value: 'credit', label: 'Cartão' }]} label="Tipo" onChange={setAccountType} value={accountType} /> : null}
          <Field label="Nome da conta" editable={!referenceAccount} onChangeText={setAccountName} value={accountName} />
          <Field keyboardType="decimal-pad" label="Saldo de referência (R$)" onChangeText={setOpeningBalance} value={openingBalance} />
          <DateField label="Saldo ao final do dia" value={openingDate} onChange={setOpeningDate} />
          <Text style={styles.meta}>O saldo gerencial soma apenas movimentos posteriores a essa data. Movimentos conciliados são contados uma única vez.</Text>
          <Button onPress={() => void perform(saveAccount)} title={referenceAccount?"Salvar referência de saldo":"Cadastrar conta"} variant="secondary" />
          <Text style={styles.meta}>A conciliação usa a mesma conta, valor exato e data próxima. Possibilidades ambíguas ficam sem vínculo automático.</Text><Button loading={importingOfx} onPress={() => void perform(importOfx)} title="Importar extrato OFX" variant="secondary" />
          {accounts.map(account=><Card key={account.id}><Text style={styles.title}>{account.name}</Text><Text style={styles.meta}>Referência: {formatCurrency(account.openingBalance)} ao final de {formatDate(account.openingBalanceDate)}</Text>
            <Text style={styles.title}>Saldo gerencial: {bankError||coreError?'Indisponível':accountBalance(account,entries,transactions)===null?'Informe a data do saldo inicial':formatCurrency(accountBalance(account,entries,transactions))}</Text>
            <Button title="Conferir saldo de referência" variant="secondary" onPress={()=>{setReferenceAccount(account.id);setAccountName(account.name);setAccountType(account.accountType);setOpeningBalance(account.openingBalance.toFixed(2).replace('.',','));setOpeningDate(account.openingBalanceDate??'');}} />
          </Card>)}
          <Button title="Limpar formulário de conta" variant="ghost" onPress={()=>{setReferenceAccount(null);setAccountName('');setOpeningBalance('0');setOpeningDate(financialToday());}} />
          {bankError?<Notice tone="danger">{bankError}</Notice>:null}
          <Text style={styles.sectionTitle}>Movimentações OFX da conta selecionada</Text>
          {transactions.filter(item=>item.accountId===accountId).slice(0,100).map(item=><View key={item.id}><Text style={styles.meta}>{formatDate(item.date)} • {item.description} • {formatCurrency(item.amount)} • {item.matchedFinancialId?'Conciliado':'Sem conciliação'}</Text></View>)}
          <Text style={styles.meta}>Exibindo até 100 movimentos recentes; o saldo usa todos os movimentos carregados.</Text>
      </Card>
);
}

export type FinancialHistorySectionProps={
  styles:Styles; archive:FinancialArchiveSummary[];archiveError:string|null;
  archivePage:number;setArchivePage:React.Dispatch<React.SetStateAction<number>>;
  entries:FinancialEntrySummary[];coreError:string|null;
  saving:boolean;perform:Perform;exportComplete:AsyncAction;resetEntries:AsyncAction;
  resetReady:boolean;setResetReady:React.Dispatch<React.SetStateAction<boolean>>;
  resetPhrase:string;setResetPhrase:React.Dispatch<React.SetStateAction<string>>;
};
export function FinancialHistorySection({styles,archive,archiveError,archivePage,setArchivePage,entries,coreError,saving,perform,exportComplete,resetEntries,resetReady,setResetReady,resetPhrase,setResetPhrase}:FinancialHistorySectionProps){
return (
<>
      <Button title="Baixar Excel completo (.xlsx)" loading={saving} onPress={()=>void perform(exportComplete)} />
      <Button title="Baixar CSV dos lançamentos ativos" disabled={Boolean(coreError)} variant="secondary" loading={saving} onPress={()=>void perform(()=>exportFinancialCsv(entries))} />
      <Text style={styles.sectionTitle}>Histórico preservado e imutável</Text>
      <Notice tone="warning">Estes registros não são apagados quando um cliente é excluído. Somente o administrador pode consultá-los.</Notice>
      {archiveError?<Notice tone="danger">{archiveError}</Notice>:null}
      {archive.slice(archivePage*50,archivePage*50+50).map((entry) => <Card key={entry.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{entry.clientName} • {entry.contractNumber}</Text><Text style={styles.meta}>{entry.description ?? entry.sourceTable} • arquivado em {formatDate(entry.archivedAt)}</Text></View><StatusPill label={formatCurrency(entry.amount ?? entry.contractValue)} /></View></Card>)}
      <View style={styles.rowFields}><Button title="Histórico anterior" variant="ghost" disabled={archivePage===0} onPress={()=>setArchivePage(value=>value-1)} /><Button title="Histórico seguinte" variant="ghost" disabled={(archivePage+1)*50>=archive.length} onPress={()=>setArchivePage(value=>value+1)} /></View>
      <Card><Text style={styles.sectionTitle}>Arquivar todos os lançamentos ativos</Text><Notice tone="warning">Faça e confira uma exportação antes de limpar os ativos. Clientes, projetos e histórico preservado permanecem.</Notice>
        <Button title="1. Preparar Excel antes da limpeza" variant="secondary" loading={saving} onPress={()=>void perform(async()=>{await exportComplete();setResetReady(true);})} />
        {resetReady?<><Field label="Após conferir o download, digite RESETAR FINANCEIRO" value={resetPhrase} onChangeText={setResetPhrase} /><Button title="2. Confirmar arquivamento e limpar ativos" disabled={resetPhrase!=='RESETAR FINANCEIRO'||saving} onPress={()=>void perform(resetEntries)} /></>:null}
      </Card></>
);
}
