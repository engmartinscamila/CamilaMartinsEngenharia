import assert from "node:assert/strict";
import { protegerDadosConfidenciais } from "../supabase/functions/notificar-atualizacao/privacy.js";

const casosProtegidos = [
  "CPF 123.456.789-10",
  "CNPJ: 12.345.678/0001-90",
  "RG nº 123456789",
  "ART 2026123456789",
  "Contrato: CME-2026/001",
  "Documento 98765432100",
  "Telefone 11999998888",
];

for (const entrada of casosProtegidos) {
  const saida = protegerDadosConfidenciais(entrada);
  assert.match(saida, /\[DADO PROTEGIDO\]/, `O filtro não protegeu: ${entrada}`);
  assert.doesNotMatch(saida, /\d{8,}/, `Um identificador permaneceu exposto: ${entrada}`);
}

const mensagemOperacional = "Reunião agendada para 30/08/2026 às 14:30. Acesse o portal.";
assert.equal(protegerDadosConfidenciais(mensagemOperacional), mensagemOperacional);

console.log("FILTRO DE PRIVACIDADE APROVADO.");
