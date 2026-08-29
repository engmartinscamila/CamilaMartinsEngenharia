import React from 'react';

import { LegalDocument } from '@/components/legal-document';
import { CURRENT_PRIVACY_VERSION, LEGAL_EFFECTIVE_DATE, privacySections } from '@/lib/legal';

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocument
      description="Saiba como os dados são usados e protegidos no aplicativo e no Portal do Cliente."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      eyebrow="LGPD"
      sections={privacySections}
      title="Política de Privacidade"
      version={CURRENT_PRIVACY_VERSION}
    />
  );
}
