/**
 * .scripts/apply-patch.js
 * Passo 2 do PLANO_EXECUCAO.md
 *
 * Substitui o original pelo arquivo .patched SOMENTE após validação.
 * Deve ser executado após validate-cardapio.js passar 100%.
 */

const fs   = require("fs");
const path = require("path");

const src     = path.join(__dirname, "../online/gestao/public/ui-desenvolvimento/index.html");
const patched = src + ".patched";
const backup  = src + ".backup-pre-fix2";

if (!fs.existsSync(patched)) {
  console.error("ERRO: .patched não encontrado. Execute fix-encoding.js primeiro.");
  process.exit(1);
}

// Salva backup do original
fs.copyFileSync(src, backup);
console.log("Backup salvo em:", backup);

// Aplica o patch
fs.copyFileSync(patched, src);
console.log("Patch aplicado em:", src);

// Remove o .patched
fs.unlinkSync(patched);
console.log("Arquivo .patched removido.");

console.log("\n✅ Patch aplicado. Próximo passo: commit + deploy.");
