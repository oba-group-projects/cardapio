'use strict';
(function(){
  const nativeFetch=window.fetch.bind(window);
  const previewPromise=nativeFetch('/api/preview',{cache:'no-store'})
    .then(async r=>{
      const j=await r.json();
      if(!r.ok||!j.payload)throw new Error(j.error||'Preview indisponivel');
      return j.payload;
    });
  const map={
    'flavors.json':'sabores',
    'categories.json':'categorias',
    'boxes.json':'caixas',
    'products.json':'produtos',
    'options.json':'opcionais',
    'combos.json':'combos',
    'config.json':'loja',
    'theme.json':'tema'
  };
  window.fetch=async function(input,init){
    const raw=typeof input==='string'?input:(input&&input.url?input.url:String(input));
    const u=new URL(raw,window.location.href);
    const name=u.pathname.split('/').pop();
    const key=map[name];
    if(key){
      const payload=await previewPromise;
      return new Response(JSON.stringify(payload[key]),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
    }
    return nativeFetch(input,init);
  };
})();
