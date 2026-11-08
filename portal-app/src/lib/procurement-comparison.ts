import type {SupplierBidSummary} from '@/types/domain';

/** Mapa comparativo informativo; menor preço não é aprovação automática. */
export type BidComparison={
  bid:SupplierBidSummary;
  priceRank:number;
  priceGap:number;
  isLowestPrice:boolean;
  isFastestKnown:boolean;
};
export type QuoteComparison={
  bids:BidComparison[];
  lowestPrice:number|null;
  highestPrice:number|null;
  fastestKnownDays:number|null;
  selectedPricePremium:number|null;
  incompleteTerms:number;
  potentialPriceGap:number|null;
};

export function analyzeSupplierQuote(
 bids:SupplierBidSummary[],
 selectedSupplierId:string|null,
):QuoteComparison {
 const valid=bids.filter(bid=>Number.isFinite(bid.totalAmount)&&bid.totalAmount>=0);
 const ordered=[...valid].sort((a,b)=>a.totalAmount-b.totalAmount||a.supplierName.localeCompare(b.supplierName)||a.id.localeCompare(b.id));
 const lowestPrice=ordered.length?ordered[0].totalAmount:null;
 const highestPrice=ordered.length?ordered[ordered.length-1].totalAmount:null;
 const times=valid.map(bid=>bid.leadTimeDays).filter((n):n is number=>n!==null&&Number.isInteger(n)&&n>=0);
 const fastestKnownDays=times.length?Math.min(...times):null;
 const bidsCompared=ordered.map((bid,index)=>({
  bid,priceRank:1+ordered.filter(item=>item.totalAmount<bid.totalAmount).length,
  priceGap:Math.round((bid.totalAmount-(lowestPrice??bid.totalAmount))*100)/100,
  isLowestPrice:bid.totalAmount===lowestPrice,
  isFastestKnown:fastestKnownDays!==null&&bid.leadTimeDays===fastestKnownDays,
 }));
 const selected=ordered.find(bid=>bid.supplierId===selectedSupplierId);
 return {
  bids:bidsCompared,lowestPrice,highestPrice,fastestKnownDays,
  selectedPricePremium:selected&&lowestPrice!==null?Math.round((selected.totalAmount-lowestPrice)*100)/100:null,
  incompleteTerms:valid.filter(bid=>!bid.paymentTerms?.trim()||bid.leadTimeDays===null).length,
  potentialPriceGap:lowestPrice!==null&&highestPrice!==null?Math.round((highestPrice-lowestPrice)*100)/100:null,
 };
}
