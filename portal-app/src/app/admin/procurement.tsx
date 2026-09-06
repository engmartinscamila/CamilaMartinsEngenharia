import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatCurrency, formatDate, isValidIsoDate, parseBrazilianCurrency } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import { listAdminProjects } from '@/services/admin-service';
import {
  addSupplierBid, createPurchaseQuote, createSupplier, listPurchaseQuotes,
  listSuppliers, selectSupplierBid,
} from '@/services/operations-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary, PurchaseQuoteSummary, SupplierSummary } from '@/types/domain';

export default function AdminProcurementScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [quotes, setQuotes] = useState<PurchaseQuoteSummary[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierCategory, setSupplierCategory] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('un');
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadBase = useCallback(async () => {
    const [projectResult, supplierResult] = await Promise.all([listAdminProjects(), listSuppliers()]);
    const valid = projectResult.data.filter((project) => project.contractId);
    setProjects(valid); setProjectId((current) => current ?? valid[0]?.id ?? null);
    setSuppliers(supplierResult.data); setError(projectResult.error ?? supplierResult.error);
  }, []);
  const loadQuotes = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); const result = await listPurchaseQuotes(projectId);
    setQuotes(result.data); setError(result.error); setLoading(false);
  }, [projectId]);
  useEffect(() => { const task = setTimeout(() => void loadBase(), 0); return () => clearTimeout(task); }, [loadBase]);
  useEffect(() => { const task = setTimeout(() => void loadQuotes(), 0); return () => clearTimeout(task); }, [loadQuotes]);

  const saveSupplier = async () => {
    if (supplierName.trim().length < 2) { setError('Informe o nome do fornecedor.'); return; }
    const actionError = await createSupplier({ name: supplierName, category: supplierCategory, phone: supplierPhone });
    if (actionError) setError(actionError); else { setSupplierName(''); setSupplierCategory(''); setSupplierPhone(''); setSuccess('Fornecedor cadastrado.'); await loadBase(); }
  };
  const saveQuote = async () => {
    const parsedQuantity = Number(quantity.replace(',', '.'));
    if (!projectId || title.trim().length < 3 || itemDescription.trim().length < 2 || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) { setError('Preencha projeto, título, item e quantidade válida.'); return; }
    if (dueDate && !isValidIsoDate(dueDate)) { setError('A data limite deve usar AAAA-MM-DD.'); return; }
    const actionError = await createPurchaseQuote({ projectId, title, description, dueDate, itemDescription, quantity: parsedQuantity, unit });
    if (actionError) setError(actionError); else { setTitle(''); setDescription(''); setDueDate(''); setItemDescription(''); setQuantity('1'); setSuccess('Cotação aberta para comparação de fornecedores.'); await loadQuotes(); }
  };
  const saveBid = async () => {
    const amount = parseBrazilianCurrency(bidAmount);
    const days = leadTime ? Number(leadTime) : null;
    if (!quoteId || !supplierId || amount === null || amount < 0 || (days !== null && (!Number.isInteger(days) || days < 0))) { setError('Selecione cotação e fornecedor; informe valor e prazo válidos.'); return; }
    const actionError = await addSupplierBid({ quoteId, supplierId, totalAmount: amount, leadTimeDays: days, paymentTerms });
    if (actionError) setError(actionError); else { setBidAmount(''); setLeadTime(''); setPaymentTerms(''); setSuccess('Proposta registrada e ranking atualizado.'); await loadQuotes(); }
  };
  const chooseBid = async (quote: PurchaseQuoteSummary, supplier: string) => {
    const actionError = await selectSupplierBid(quote.id, supplier);
    if (actionError) setError(actionError); else { setSuccess('Fornecedor escolhido e cotação aprovada.'); await loadQuotes(); }
  };

  return (
    <Screen>
      <AdminPageHeader title="Fornecedores e cotações" description="Compare preço, prazo e condição de pagamento por projeto." />
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
      <Card><Text style={styles.sectionTitle}>Projeto</Text><View style={styles.chips}>{projects.map((project) => <Pressable key={project.id} onPress={() => setProjectId(project.id)} style={[styles.chip, projectId === project.id && styles.selected]}><Text style={styles.chipText}>{project.contractNumber} • {project.name}</Text></Pressable>)}</View></Card>
      <View style={styles.columns}>
        <Card style={styles.column}><Text style={styles.sectionTitle}>Novo fornecedor</Text><Field label="Nome *" onChangeText={setSupplierName} value={supplierName} /><Field label="Categoria" onChangeText={setSupplierCategory} value={supplierCategory} /><Field label="Telefone / WhatsApp" onChangeText={setSupplierPhone} value={supplierPhone} /><Button onPress={() => void saveSupplier()} title="Cadastrar fornecedor" /></Card>
        <Card style={styles.column}><Text style={styles.sectionTitle}>Abrir cotação</Text><Field label="Título *" onChangeText={setTitle} value={title} /><Field label="Descrição" multiline onChangeText={setDescription} value={description} /><Field label="Data limite (AAAA-MM-DD)" onChangeText={setDueDate} value={dueDate} /><Field label="Primeiro item *" onChangeText={setItemDescription} value={itemDescription} /><View style={styles.row}><Field keyboardType="decimal-pad" label="Quantidade" onChangeText={setQuantity} value={quantity} /><Field label="Unidade" onChangeText={setUnit} value={unit} /></View><Button onPress={() => void saveQuote()} title="Abrir cotação" /></Card>
      </View>
      <Card>
        <Text style={styles.sectionTitle}>Registrar proposta recebida</Text>
        <Text style={styles.label}>Cotação</Text><View style={styles.chips}>{quotes.filter((quote) => !['approved', 'ordered', 'cancelled'].includes(quote.status)).map((quote) => <Pressable key={quote.id} onPress={() => setQuoteId(quote.id)} style={[styles.chip, quoteId === quote.id && styles.selected]}><Text style={styles.chipText}>{quote.title}</Text></Pressable>)}</View>
        <Text style={styles.label}>Fornecedor</Text><View style={styles.chips}>{suppliers.map((supplier) => <Pressable key={supplier.id} onPress={() => setSupplierId(supplier.id)} style={[styles.chip, supplierId === supplier.id && styles.selected]}><Text style={styles.chipText}>{supplier.name}</Text></Pressable>)}</View>
        <View style={styles.row}><Field keyboardType="decimal-pad" label="Valor total (R$)" onChangeText={setBidAmount} value={bidAmount} /><Field keyboardType="number-pad" label="Prazo (dias)" onChangeText={setLeadTime} value={leadTime} /></View>
        <Field label="Condição de pagamento" onChangeText={setPaymentTerms} value={paymentTerms} />
        <Button onPress={() => void saveBid()} title="Registrar proposta" />
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>Mapa comparativo</Text>
        {quotes.length === 0 ? <StateView icon="cart-outline" title="Nenhuma cotação" description="Abra uma cotação e registre as propostas recebidas." /> : quotes.map((quote) => <View key={quote.id} style={styles.quote}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{quote.title}</Text><Text style={styles.meta}>{quote.itemCount} item(ns) • limite {quote.dueDate ? formatDate(quote.dueDate) : 'sem data'}</Text></View><StatusPill label={quote.status} tone={quote.status === 'approved' ? 'success' : 'warning'} /></View>{quote.bids.length === 0 ? <Text style={styles.meta}>Aguardando propostas.</Text> : quote.bids.map((bid, index) => <View key={bid.id} style={[styles.bid, quote.selectedSupplierId === bid.supplierId && styles.winner]}><View style={{ flex: 1 }}><Text style={styles.title}>{index + 1}º • {bid.supplierName}</Text><Text style={styles.meta}>{formatCurrency(bid.totalAmount)} • {bid.leadTimeDays ?? '—'} dia(s) • {bid.paymentTerms || 'condição não informada'}</Text></View><Button disabled={quote.selectedSupplierId === bid.supplierId} onPress={() => void chooseBid(quote, bid.supplierId)} title={quote.selectedSupplierId === bid.supplierId ? 'Escolhido' : 'Escolher'} variant="ghost" /></View>)}</View>)}
      </Card>
      <Button loading={loading} onPress={() => void loadQuotes()} title="Atualizar cotações" variant="secondary" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.family },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17, fontFamily: typography.family },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  chipText: { color: colors.slate, fontSize: 11, fontFamily: typography.family },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  column: { flex: 1, minWidth: 280 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  quote: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  bid: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  winner: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
});
