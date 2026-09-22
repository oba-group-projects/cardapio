/**
 * .scripts/fix-encoding.js
 * Passo 2 do PLANO_EXECUCAO.md
 *
 * Corrige chars corrompidos VISÍVEIS ao usuário no cardápio.
 * Opera em CÓPIA do arquivo — nunca sobrescreve o original diretamente.
 * Salva em: <arquivo>.patched
 * Só substitui o original se validate-cardapio.js passar 100%.
 *
 * Regra: substituições declarativas, uma por linha, auditáveis.
 */

const fs   = require("fs");
const path = require("path");

const src  = path.join(__dirname, "../online/gestao/public/ui-desenvolvimento/index.html");
const dest = src + ".patched";

const raw = fs.readFileSync(src);
let c = raw.toString("utf8");

const before = (c.match(/\uFFFD/g) || []).length;
console.log("U+FFFD antes:", before);

// ============================================================
// SUBSTITUIÇÕES DECLARATIVAS
// Formato: [string_ou_regex_corrompida, string_correta]
// Ordem: mais específicas primeiro
// ============================================================
const fixes = [

  // --- Separadores de texto (ponto médio ·) ---
  // "Caixa sortida ◆🔲 ${n} doces" -> "Caixa sortida · ${n} doces"
  [/(\w) \uFFFD\u001d /g,          "$1 \u00B7 "],
  [/ \uFFFD\u001d (\d)/g,          " \u00B7 $1"],
  [/ \uFFFD\u001d \$/g,            " \u00B7 $"],
  [/\} \uFFFD\u001d at/g,          "} \u00B7 at"],
  [/\uFFFD\u001d /g,               "\u00B7 "],

  // --- Seta para baixo (↓ Mais sabores abaixo) ---
  [/`\uFFFDS\u001c /g,             "`\u2193 "],
  [/`\uFFFD \u001c /g,             "`\u2193 "],
  [/>\uFFFD \u001c /g,             ">\u2193 "],
  [/'\uFFFD \u001c /g,             "'\u2193 "],

  // --- Emoji 🎉 (mínimo atingido, caixa completa) ---
  [/\uFFFD\u0014/g,                "\uD83C\uDF89"],
  [/Completa! \uFFFDx\}0/g,        "Completa! \uD83C\uDF89"],
  [/\uFFFDx\}0/g,                  "\uD83C\uDF89"],
  [/\uFFFDx\u2190/g,               "\u2022"],

  // --- Seta direita → (botões avançar/finalizar) ---
  [/\uFFFD \u0019/g,               " \u2192"],
  [/ \uFFFD\u0019/g,               " \u2192"],
  [/\uFFFD\u0019/g,                "\u2192"],

  // --- Seta esquerda ← (botões voltar) ---
  [/\uFFFD\s+\uFFFD\s+Voltar/g,    "\u2190 Voltar"],
  [/'\uFFFD\s+\uFFFD\s+Voltar/g,   "'\u2190 Voltar"],
  [/"\uFFFD\s+\uFFFD\s+Voltar/g,   '"\u2190 Voltar'],
  [/>\uFFFD \uFFFD Voltar</g,       ">\u2190 Voltar<"],
  [/\uFFFD\uFFFD Voltar/g,         "\u2190 Voltar"],
  [/\uFFFD\s+\uFFFD\s+Revisar/g,   "\u2190 Revisar"],
  [/\uFFFD\s+\uFFFD\s+Alterar/g,   "\u2190 Alterar"],
  [/'\uFFFD\s+\uFFFD\s+Alterar sabores'/g, "'\u2190 Alterar sabores'"],
  [/'\uFFFD\s+\uFFFD\s+Revisar carrinho/g, "'\u2190 Revisar carrinho"],

  // --- Sinal de menos − (botão reduzir quantidade) ---
  [/'\uFFFD\u0013\uFFFD'/g,        "'\u2212'"],
  [/"\uFFFD\u0013\uFFFD"/g,        '"\u2212"'],

  // --- Checkmark ✅ (status mínimo atingido, adicionado ao carrinho) ---
  [/M\u00EDnimo atingido \uFFFDS/g,         "M\u00EDnimo atingido \u2705"],
  [/m\u00EDnimo atingido \uFFFDS/g,         "m\u00EDnimo atingido \u2705"],
  [/Adicionado ao carrinho \uFFFDS/g,       "Adicionado ao carrinho \u2705"],
  [/'\uFFFDS Caixa/g,                       "'\u2705 Caixa"],
  [/ \uFFFDS'/g,                            " \u2705'"],
  [/ \uFFFDS`/g,                            " \u2705`"],
  [/>\uFFFDS\n/g,                           ">\u2705\n"],
  [/ \uFFFDS\n/g,                           " \u2705\n"],
  [/ \uFFFDS /g,                            " \u2705 "],
  [/'\uFFFDS'/g,                            "'\u2705'"],
  [/checkpoint !== 'NENHUM'\s*\n\s*\? ' \uFFFDS'/g, "checkpoint !== 'NENHUM'\n            ? ' \u2705'"],
  [/>\uFFFDS\n\s*<\/div>/g,                 ">\u2705\n</div>"],
  [/\/\^\uFFFDS\\s\*\//g,                   "/^\u2705\\s*/"],

  // --- Setas em indicadores de scroll (↑↓) ---
  [/\uFFFD  MAIS PRODUTOS/g,               "\u2191 MAIS PRODUTOS"],
  [/`\uFFFD  MAIS /g,                      "`\u2191 MAIS "],
  [/'\uFFFD  H\u00C1 PRODUTOS ACIMA'/g,   "'\u2191 H\u00C1 PRODUTOS ACIMA'"],
  [/aria-hidden="true">\uFFFD <\/span>/g,  "aria-hidden=\"true\">\u2193<\/span>"],
  [/class="r117b2-arrow">\s*\uFFFD\s*\n/g, "class=\"r117b2-arrow\">\u2193\n"],

  // --- Palavras com AÇÃO/SELEÇÃO/EDIÇÃO/etc ---
  [/A\uFFFD!\u00D2O/g,                    "A\u00C7\u00C3O"],
  [/TRANSI\uFFFD!\u00D2O/g,              "TRANSI\u00C7\u00C3O"],
  [/RENDERIZA\uFFFD!\u00D2O/g,           "RENDERIZA\u00C7\u00C3O"],
  [/REFOR\uFFFD!O/g,                     "REFOR\u00C7O"],
  [/ALTERA\uFFFD!\u00D2O/g,             "ALTERA\u00C7\u00C3O"],
  [/EDI\uFFFD!\u00D2O/g,               "EDI\u00C7\u00C3O"],
  [/SELE\uFFFD!\u00D2O/g,              "SELE\u00C7\u00C3O"],
  [/SELE\uFFFD!\u00d2O/g,              "SELE\u00C7\u00C3O"],
  [/A\uFFFD!\uFFFD"ES/g,               "A\u00C7\u00D5ES"],
  [/SE\uFFFD!\uFFFD"ES/g,              "SE\u00C7\u00D5ES"],
  [/BOT\uFFFD"ES/g,                    "BOT\u00D5ES"],
  [/MENU DE BOT\uFFFD"ES/g,           "MENU DE BOT\u00D5ES"],
  [/C\uFFFDDIGO/g,                    "C\u00D3DIGO"],
  [/UMA \uFFFDaNICA/g,                 "UMA \u00DANICA"],
  [/\* \uFFFDaNICO/g,                  "* \u00DANICO"],
  [/\/\/ \uFFFDaNICO/g,                "// \u00DANICO"],
  [/VOLTAR AS OP\uFFFD!\uFFFD"ES/g,   "VOLTAR \u00C0S OP\u00C7\u00D5ES"],
  [/VOLTAR \u00C0S OP\uFFFD!\uFFFD"ES/g, "VOLTAR \u00C0S OP\u00C7\u00D5ES"],
  [/\uFFFDaltima etapa/g,              "\u00FAltima etapa"],
  [/SELE\uFFFD!\u00d2/g,              "SELE\u00C7\u00C3"],

  // --- Comentários decorativos (bordas ←←←← nos /* */) ---
  [/\uFFFD(\u2190)+/g,               ""],
  [/(\u2190)+\uFFFD/g,               ""],

  // --- CÓDIGO em mensagem WhatsApp ---
  [/\*C\uFFFDDIGO:\*/g,              "*C\u00D3DIGO:*"],
  [/`\*C\uFFFD\u001cDIGO:\*/g,       "`*C\u00D3DIGO:*"],
  [/C\uFFFD\u001cDIGO/g,             "C\u00D3DIGO"],

  // --- ↑ MAIS PRODUTOS (FFFD + U+0020 + U+001C) ---
  [/\uFFFD \u001c MAIS PRODUTOS/g,   "\u2191 MAIS PRODUTOS"],
  [/`\uFFFD \u001c MAIS /g,          "`\u2191 MAIS "],
  [/'\uFFFD \u0018 H\u00C1/g,        "'\u2191 H\u00C1"],
  [/'\uFFFD  H\u00C1 PRODUTOS ACIMA'/g, "'\u2191 H\u00C1 PRODUTOS ACIMA'"],

  // --- r117b2-arrow seta ↓ (FFFD + U+0020 + U+001C) ---
  [/aria-hidden="true">\uFFFD \u001c<\/span>/g, "aria-hidden=\"true\">\u2193<\/span>"],
  [/>[ ]*\uFFFD[ ]*\u001c[ ]*<\/span>/g,        ">\u2193<\/span>"],

  // --- ✅S no marco e notificação (FFFD + S + U+001C) ---
  [/\uFFFDS\u001c\s*<\/div>/g,                  "\u2705\n</div>"],
  [/'\uFFFDS\u001c Caixa/g,                     "'\u2705 Caixa"],
  [/ '\uFFFDS\u001c'/g,                         " '\u2705'"],
  [/\? ' \uFFFDS\u001c'/g,                      "? ' \u2705'"],
  [/ \uFFFDS\u001c /g,                          " \u2705 "],
  [/>\uFFFDS\u001c/g,                           ">\u2705"],

  // --- Bordas decorativas nos comentários (FFFD + U+001D + ←) ---
  [/\uFFFD\u001d(\u2190)+/g,          ""],
  [/(\u2190)+\u001d\uFFFD/g,          ""],
  [/ \uFFFD\u001d\u2190/g,            " "],
  [/\u001d\uFFFD\r?\n/g,              "\n"],
];

let count = 0;
for (const [pattern, replacement] of fixes) {
  const prev = c;
  c = c.replace(pattern, replacement);
  if (c !== prev) count++;
}

const after = (c.match(/\uFFFD/g) || []).length;
console.log("U+FFFD depois:", after, "| Redução:", before - after);
console.log("Regras que fizeram match:", count);

fs.writeFileSync(dest, c, "utf8");
console.log("Cópia salva em:", dest);
console.log("Agora execute: node .scripts/validate-cardapio.js");
