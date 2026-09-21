'use strict';
(function(){
  // Bootstrap para o cardápio público (/cardapio)
  // Lê os dados do slot PUBLISHED via /api/catalog (rota pública, sem autenticação)
  const nativeFetch = window.fetch.bind(window);

  const publishedPromise = nativeFetch('/api/catalog', { cache: 'no-store' })
    .then(async function(r) {
      const j = await r.json();
      if (!r.ok || !j) throw new Error('Dados do cardápio indisponíveis');
      // /api/catalog retorna { ok: true, data: { sabores, categorias, ... } }
      // ou diretamente { sabores, categorias, ... } dependendo da versão
      return j.data || j;
    });

  const map = {
    'flavors.json':    'sabores',
    'categories.json': 'categorias',
    'boxes.json':      'caixas',
    'products.json':   'produtos',
    'options.json':    'opcionais',
    'combos.json':     'combos',
    'config.json':     'loja',
    'theme.json':      'tema'
  };

  window.fetch = async function(input, init) {
    const raw = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
    const u = new URL(raw, window.location.href);
    const name = u.pathname.split('/').pop();
    const key = map[name];
    if (key) {
      const data = await publishedPromise;
      const value = data[key] || data.payload && data.payload[key] || null;
      return new Response(
        JSON.stringify(value),
        { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }
      );
    }
    return nativeFetch(input, init);
  };
})();
