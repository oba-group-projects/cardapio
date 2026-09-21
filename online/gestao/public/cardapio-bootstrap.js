'use strict';
// v2 — fix payload /api/catalog
(function(){
  // Bootstrap para o cardápio público (/cardapio)
  // Lê os dados do slot PUBLISHED via /api/catalog (rota pública, sem autenticação)
  var nativeFetch = window.fetch.bind(window);

  var publishedPromise = nativeFetch('/api/catalog', { cache: 'no-store' })
    .then(function(r) {
      return r.json().then(function(j) {
        if (!r.ok || !j) throw new Error('Dados do cardapio indisponiveis');
        // /api/catalog retorna { ok: true, data: { sabores, caixas, ... }, caixas, sabores, ... }
        // Usamos j.data se existir, senão j direto
        return j.data || j;
      });
    });

  var map = {
    'flavors.json':    'sabores',
    'categories.json': 'categorias',
    'boxes.json':      'caixas',
    'products.json':   'produtos',
    'options.json':    'opcionais',
    'combos.json':     'combos',
    'config.json':     'loja',
    'theme.json':      'tema'
  };

  window.fetch = function(input, init) {
    var raw = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
    var u = new URL(raw, window.location.href);
    var name = u.pathname.split('/').pop();
    var key = map[name];
    if (key) {
      return publishedPromise.then(function(data) {
        var value = data[key];
        if (value === undefined && data.payload) value = data.payload[key];
        return new Response(
          JSON.stringify(value !== undefined ? value : null),
          { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }
        );
      });
    }
    return nativeFetch(input, init);
  };
})();
