# App e portal integrados — 0.10.9

Base: portal-app do site em 0cae6d8, preservando módulos atuais de contratos,
documentos, finanças, CRM e operação. O APK fornecido é 0.10.7, versionCode 6;
as melhorias compatíveis do ramo 0.10.8 foram consideradas sem substituir os
módulos adicionados posteriormente no site.

## Correções

- Administrador validado por is_portal_admin(), sem consultar UUID em id numérico.
- Clientes suspensos não entram pelo fallback de colaborador; erro de verificação
  de identidade não concede papel.
- Primeiro acesso e recuperação usam a mesma função de envio do site. O link abre
  a página oficial de redefinição e a nova senha funciona no site e no app.
- Respostas de identificação atrasadas não restauram uma sessão encerrada.
- Renovação de token não desmonta formulários e navegação.
- Atualização ao voltar ao app, por eventos e com conferência periódica; telas
  administrativas principais atualizam ao receber alterações e voltar ao foco.
- Biblioteca legada usa o bucket correto; PDFs são emitidos pelo serviço protegido.
- Serviço de documentos reconhece autoral legado e bucket ausente, preservando RLS
  e exigindo administrador para abrir o original.
- Upload múltiplo no app mantém somente arquivos que falharam para nova tentativa.
- Word gerado abre o compartilhamento nativo para salvar ou escolher o aplicativo.
- Campo de senha com opção mostrar/ocultar e tratamento de erro de conexão.
- Identificadores Android e Firebase de notificações preservados. Não há um
  segundo login nem cópia da senha para Firebase.

## Validação e limites

Testes de integração usam identidades e serviços sintéticos, sem enviar mensagens
nem alterar dados de clientes. Regressões do banco testam isolamento A/B. TypeScript,
ESLint, patches de segurança e Expo Doctor fazem parte da validação.

O workflow android-release compila o mesmo portal-app, instala o APK em emulador
e verifica processo e tela de login. O artefato intermediário não é a entrega:
precisa receber a assinatura final fora do repositório. A versão 0.10.7 fornecida
tem certificado Android Debug. A nova assinatura exige uma reinstalação inicial;
os dados que estão no servidor não são removidos pela reinstalação do aplicativo.

Push em aparelho físico e autenticação com contas reais exigem confirmação no
dispositivo; build e testes sintéticos não comprovam entrega real de notificações.
