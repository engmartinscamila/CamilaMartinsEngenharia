import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Notice, PageHeader, Screen } from '@/components/ui';
import { openExternalUrl } from '@/lib/external-link';
import { PRIVACY_CONTACT_EMAIL } from '@/lib/legal';
import { useAuth } from '@/providers/auth-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { ThemeColors, typography } from '@/theme/tokens';

export default function PrivacyScreen(){
 const router=useRouter(); const {role}=useAuth(); const [error,setError]=useState<string|null>(null); const styles=useThemeStyles(styleDefinitions);
 return <Screen><PageHeader eyebrow="Privacidade e proteção" title="Seus dados protegidos" description="Informações claras sobre privacidade, acesso e proteção dos dados utilizados no portal e no aplicativo."/>{error?<Notice tone="danger">{error}</Notice>:null}
 <Card><Text style={styles.title}>Acesso individual e protegido</Text><Text style={styles.body}>Seu acesso é pessoal e vinculado à sua conta e aos seus projetos. Documentos, imagens e informações privadas são disponibilizados somente conforme as permissões atribuídas ao seu cadastro.</Text></Card>
 <Card><Text style={styles.title}>Proteção das informações</Text><Text style={styles.body}>São utilizados controles de acesso, sessões autenticadas, armazenamento privado e links temporários quando necessários. Materiais técnicos autorais também podem receber identificação ou marca d’água para preservar sua origem e integridade.</Text></Card>
 <Card><Text style={styles.title}>Privacidade e LGPD</Text><Text style={styles.body}>O tratamento de dados pessoais observa a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018). Os dados são utilizados para identificação, comunicação, execução dos serviços contratados, acompanhamento dos projetos e funcionamento seguro da área do cliente.</Text></Card>
 <Card><Text style={styles.title}>Responsabilidade compartilhada</Text><Text style={styles.body}>A proteção também depende do uso adequado da conta. Mantenha sua senha em sigilo, proteja o desbloqueio do aparelho e encerre a sessão em dispositivos que não estejam sob seu controle.</Text></Card>
 <Card><Text style={styles.title}>Seus direitos</Text><Text style={styles.body}>Você pode solicitar informações, acesso, correção e demais providências aplicáveis aos seus dados pessoais. Para sua própria proteção, a identidade do solicitante poderá ser confirmada antes do atendimento.</Text>{role==='client'?<Button onPress={()=>router.push({pathname:'/(client)/requests',params:{assunto:'Privacidade e dados pessoais'}})} title="Falar sobre meus dados" variant="secondary"/>:null}<Button onPress={()=>void openExternalUrl(`mailto:${PRIVACY_CONTACT_EMAIL}?subject=Privacidade%20e%20dados%20pessoais`,['mailto']).then(setError)} title="Contato de privacidade" variant="secondary"/></Card>
 <Card><Text style={styles.title}>Transparência</Text><Text style={styles.body}>Os documentos completos permanecem disponíveis para consulta sempre que desejar.</Text><Button onPress={()=>router.push('/privacy-policy')} title="Política de Privacidade" variant="secondary"/><Button onPress={()=>router.push('/terms-of-use')} title="Termos de Uso" variant="secondary"/></Card></Screen>;
}
const styleDefinitions=(colors:ThemeColors)=>({title:{color:colors.ink,fontFamily:typography.family,fontSize:typography.size.bodyLarge,fontWeight:'700'},body:{color:colors.slate,fontFamily:typography.family,fontSize:typography.size.body,lineHeight:22}});