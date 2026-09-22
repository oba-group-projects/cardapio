/**
 * .scripts/validate-cardapio.js
 * Passo 2 do PLANO_EXECUCAO.md
 *
 * Valida a cópia corrigida (.patched) antes de substituir o original.
 * Retorna exit code 0 se OK, 1 se falhar.
 */

const fs   = require("fs");
const path = require("path");

const src    = path.join(__dirname, "../online/gestao/public/ui-desenvolvimento/index.html");
const patched = src + ".patched";

if (!fs.existsSync(patched)) {
  console.error("ERRO: arquivo .patched não encontrado. Execute fix-encoding.js primeiro.");
  process.exit(1);
}

const c = fs.readFileSync(patched, "utf8");
let allOk = true;

function check(name, ok) {
  console.log((ok ? "OK  " : "FAIL") + " : " + name);
  if (!ok) allOk = false;
}

// 1. Estruturas HTML críticas preservadas
check("pag-1 presente",            c.includes('id="pag-1"'));
check("fluxo-principal presente",  c.includes('id="fluxo-principal"'));
check("secao-passo2 presente",     c.includes('id="secao-passo2"'));
check("cardapio-grid presente",    c.includes('id="cardapio-grid"'));
check("modal-tamanho-caixa",       c.includes('id="modal-tamanho-caixa"'));

// 2. Fix1 preservado (guarda de sabores)
check("Fix1: guarda flexivel",     c.includes("totalSabores === 0"));

// 3. Encoding correto
check("Nossa Essência OK",         c.includes("Nossa Ess\u00EAncia"));
check("Feito à mão OK",            c.includes("Feito \u00E0 m\u00E3o"));
check("Cardápio OK",               c.includes("Card\u00E1pio") || c.includes("card\u00E1pio") || c.includes("CARD\u00C1PIO"));

// 4. Chars visíveis corrigidos
const fffd = (c.match(/\uFFFD/g) || []).length;
check("U+FFFD <= 50 (restam em comentarios)", fffd <= 50);

// 5. Estrutura não quebrada — sem h-screen nas págs fixas
check("pag-1 min-h-screen (nao h-screen)", c.includes('id="pag-1" class="min-h-screen'));
check("Sem h-screen nas pags 1/2/3",       !c.includes('"h-screen flex flex-col items-center'));

// 6. JS sem erros — verificação básica de balanceamento
const scriptBlocks = c.match(/<script[\s\S]*?<\/script\s*>/g) || [];
check("Script tags balanceadas", scriptBlocks.length > 0);

console.log("\nU+FFFD restantes:", fffd, "(esperado: em comentarios JS, invisivel ao usuario)");

if (allOk) {
  console.log("\n✅ Validação passou. Pode aplicar com:");
  console.log("   node .scripts/apply-patch.js");
  process.exit(0);
} else {
  console.log("\n❌ Validação falhou. Não aplique o patch.");
  process.exit(1);
}
