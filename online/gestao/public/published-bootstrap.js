'use strict';
// published-bootstrap.js — idêntico ao preview-bootstrap.js mas lê /api/catalog (PUBLISHED)
(function(){
  var nativeFetch = window.fetch.bind(window);

  /* Fetch com retry — tenta até 3 vezes com backoff de 1s entre tentativas */
  function fetchComRetry(url, opts, tentativas) {
    tentativas = tentativas || 3;
    return nativeFetch(url, opts).catch(function(err) {
      if (tentativas <= 1) throw err;
      return new Promise(function(resolve) { setTimeout(resolve, 1000); })
        .then(function() { return fetchComRetry(url, opts, tentativas - 1); });
    });
  }

  var publishedPromise = fetchComRetry('/api/catalog', {cache:'no-store'})
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
        sabores:       d.sabores       || d.flavors    || [],
        categorias:    d.categorias    || d.categories || [],
        caixas:        d.caixas        || d.boxes      || [],
        produtos:      d.produtos      || d.products   || [],
        opcionais:     d.opcionais     || d.options    || [],
        combos:        d.combos        || [],
        loja:          loja,
        tema:          d.tema          || d.theme      || {},
        tema_catalogo: d.tema_catalogo || {}
      };
    });

  var map = {
    'flavors.json':         'sabores',
    'categories.json':      'categorias',
    'boxes.json':           'caixas',
    'products.json':        'produtos',
    'options.json':         'opcionais',
    'combos.json':          'combos',
    'config.json':          'loja',
    'theme.json':           'tema',
    'theme-catalogo.json':  'tema_catalogo'
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
