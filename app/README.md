# nó · área do projeto

Base autenticada da operação, construída com React 19, Vite, TypeScript, Tailwind CSS 3 e Supabase.

## Ambiente local

Copie `.env.example` para um arquivo local ignorado pelo Git e preencha `VITE_SUPABASE_ANON_KEY` com a chave pública `anon` do Supabase local. Nenhuma chave `service_role` é usada pelo frontend.

```powershell
npm install
npm run dev
```

## Provas

```powershell
npm test -- --run
npm run test:e2e
npm run lint
npx tsc -b --pretty false
npm run build
```

O E2E usa Chromium local em `1440x900` e `375x812`, inicia o Vite na porta 5174 quando necessário e reutiliza um servidor já saudável.

## Assets oficiais copiados

As cópias abaixo derivam diretamente das fontes da identidade v2 na raiz do repositório (o favicon teve apenas whitespace removido):

- `public/no-tech-stack-tinta-ponto-ambar.svg` ← `brand/lockup/svg/no-tech-stack-tinta-ponto-ambar.svg`
- `public/barra-topo-4-cores.svg` ← `brand/elements/barra-topo-4-cores.svg`
- `public/favicon.svg` ← `brand/favicon/favicon.svg`
- `public/fonts/sora-variable-wght.woff2` ← `brand/fonts/sora/sora-variable-wght.woff2`
- `public/fonts/jetbrains-mono-variable-wght.woff2` ← `brand/fonts/jetbrains-mono/jetbrains-mono-variable-wght.woff2`

As telas dos módulos são marcadores provisórios: a copy segue explicitamente marcada para revisão até a decisão de produto correspondente.
