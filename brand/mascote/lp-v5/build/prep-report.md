# prep-report — mascote-no-3d-v5

## Tarefa A — extração do v4

Fonte: `C:\Users\lucca\Downloads\mascote-no-3d-v4.html` (5307 linhas, 2331775 bytes).

1. **`build/vendor-gltfloader.js`** — IIFE do OrbitControls + GLTFLoader + extensões.
   - Linhas fonte reais: 68–4742 (não 68–4743 como estimado; linha 4743 é `</script>`, não faz parte do IIFE).
   - Linha 68 tinha prefixo `<script>` colado em `( function () {` — removido na extração.
   - Resultado: 4675 linhas, 122943 bytes.
   - Início confere: `( function () {`
   - Fim confere: `} )();`

2. **`build/eye-mask.b64.txt`** — base64 puro do PNG da máscara dos olhos.
   - Fonte: linha 63 (`<script id='eye-mask' type='text/plain'>...</script>`).
   - Tamanho: 2328 bytes (é pequeno mesmo — não é "gigante" como eu esperava antes de olhar; a máscara comprime bem por ser simples).
   - Decodificado: 1746 bytes, assinatura PNG válida `89 50 4E 47 0D 0A 1A 0A`, dimensões 1024x1024, modo L (grayscale). Validado com PIL.

3. **`build/v4-style-reference.css`** — CSS completo do `<style>` (linhas 8–32 do fonte, exclusive das tags `<style>`/`</style>`).
   - 25 linhas, 1992 bytes.
   - Contém os tokens: `--amber:#EDA33B; --blue:#3D63DB; --green:#30A46C; --red:#E0543C; --ink:#17181c; --bg:#FAFAF7`, fonte `ui-monospace,'Cascadia Mono',Consolas,monospace`, botões pill (`border-radius:999px`, borda `#d8d5cd`, estado `.on` com fundo `--ink`), dots `16x16 border-radius:4px`.

## Tarefa B — cenas (bg + oclusão)

Fonte: `C:\Users\lucca\Downloads\cenas-lp\cena1.png` … `cena6.png`, todas 1672x941 (RGB). Nenhuma precisou de resize (já abaixo do limite de 1920px no lado maior — o passo de resize existe no script mas não disparou).

Saída em `brand/mascote/lp-v5/assets/`:

| cena | dimensões | occlusionY (px) | occlusionY (%) | bg.webp | occlusion.webp | observação |
|---|---|---|---|---|---|---|
| cena1 | 1672x941 | 825 | 87.7% | 34.0 KB | 15.7 KB | mesa c/ papéis e luminária, pessoa sentada — borda frontal do tampo |
| cena2 | 1672x941 | 660 | 70.1% | 40.4 KB | 29.6 KB | bancada de laboratório, pessoa em pé — borda frontal do tampo |
| cena3 | 1672x941 | 655 | 69.6% | 30.4 KB | 25.6 KB | banco de madeira, pessoa sentada — borda frontal do assento |
| cena4 | 1672x941 | 610 | 64.8% | 17.9 KB | 15.1 KB | balcão de loja, pessoa em pé — borda frontal do tampo (balcão alto) |
| cena5 | 1672x941 | 645 | 68.5% | 36.4 KB | 30.3 KB | mesa de home office, pessoa sentada — borda frontal do tampo |
| cena6 | 1672x941 | 795 | 84.5% | 36.7 KB | 28.1 KB | mesa de estudos, pessoa sentada — borda frontal do tampo |

Metodologia do occlusionY: sobrepus grid de pixels (linhas horizontais rotuladas a cada 20px, com margem de texto fora da foto pra não sujar a leitura) em cada imagem e li visualmente a linha onde a borda frontal do móvel (tampo da mesa/bancada/balcão ou assento do banco) cruza o frame, na região central onde o mascote provavelmente ficará. Não é detecção por cor/borda automática — é leitura visual assistida por grid, como pedido. Vai precisar de calibração fina depois com Playwright.

Validação técnica: `cena1-occlusion.webp` conferido via numpy — alpha=0 em y=800 (acima da linha), alpha=255 em y=830 e y=900 (abaixo da linha). RGBA preservado no WebP pelo PIL.

## Arquivos gerados
```
build/vendor-gltfloader.js
build/eye-mask.b64.txt
build/v4-style-reference.css
build/prep-report.md
assets/cena1-bg.webp, assets/cena1-occlusion.webp
assets/cena2-bg.webp, assets/cena2-occlusion.webp
assets/cena3-bg.webp, assets/cena3-occlusion.webp
assets/cena4-bg.webp, assets/cena4-occlusion.webp
assets/cena5-bg.webp, assets/cena5-occlusion.webp
assets/cena6-bg.webp, assets/cena6-occlusion.webp
```
