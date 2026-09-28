# CSS exclusivo da home

Edite `lp-narrador/cenas-lp/historia/home-styles.source.css`. O CSS crítico é embutido no HTML; `home.min.css` contém o restante. As folhas compartilhadas não são alteradas.

Para regenerar a partir da raiz:

```powershell
npm install --prefix .checks/home-assets
npm --prefix .checks/home-assets run build
```

O build preserva os estados criados pelos scripts e retira seletores sem uso. Revise a home em desktop e celular depois de mudar classes dinâmicas. O harness `.checks/home-preview.html` aceita `w`, `h` e `section` na query.

## Agência

Depois de instalar as mesmas dependências, rode `node .checks/home-assets/build-agency.cjs`. O script lê os estilos originais, gera `agencia/agencia.min.css` e atualiza o CSS crítico em `agencia/index.html`. Não edite o bundle gerado diretamente.
