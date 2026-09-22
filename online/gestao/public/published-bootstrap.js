'use strict';
// published-bootstrap.js — idêntico ao preview-bootstrap.js mas lê /api/catalog (PUBLISHED)
(function(){
  var nativeFetch = window.fetch.bind(window);
  var publishedPromise = nativeFetch('/api/catalog', {cache:'no-store'})
    .then(function(r){ return r.json(); })
    .then(function(j){
      if (!j) throw new Error('catalog unavailable');
      // /api/catalog retorna { ok, data: {...}, sabores, caixas, ... }
      // Retorna o payload no mesmo formato que preview-bootstrap espera
      var d = j.data || j;
      var loja = d.loja || d.store || {};
      // Limpa basePath para forçar uso do LEGACY_ASSET_BASE_URL (GitHub raw)
      // que é o fallback correto quando basePath não resolve imagens locais
      if (loja.assets) { loja.assets.basePath = ''; loja.assets.imageRoot = ''; }
      return {
        sabores:    d.sabores    || d.flavors    || [],
        categorias: d.categorias || d.categories || [],
        caixas:     d.caixas     || d.boxes      || [],
        produtos:   d.produtos   || d.products   || [],
        opcionais:  d.opcionais  || d.options    || [],
        combos:     d.combos     || [],
        loja:       loja,
        tema:       d.tema       || d.theme      || {}
      };
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
      return publishedPromise.then(function(payload){
        return new Response(
          JSON.stringify(payload[key]),
          {status:200, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}}
        );
      });
    }
    return nativeFetch(input, init);
  };
})();
