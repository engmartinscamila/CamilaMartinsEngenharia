import React from 'react';

import { LegalDocument } from '@/components/legal-document';
import { CURRENT_TERMS_VERSION, LEGAL_EFFECTIVE_DATE, termsSections } from '@/lib/legal';

export default function TermsOfUseScreen() {
  return (
    <LegalDocument
      description="Condições para utilizar a área autenticada da Camila Martins Engenharia."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      eyebrow="Acesso autorizado"
      sections={termsSections}
      title="Termos de Uso"
      version={CURRENT_TERMS_VERSION}
    />
  );
}
