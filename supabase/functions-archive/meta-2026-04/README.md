# Legado Meta de abril (fora de produção)

Arquivadas em 30/09/2026 pelo movimento `hub-marketing-agentes` (spec rev. 3.1, decisão C4): `oauth-callback`, `refresh-tokens`, `sync-meta-ads` e `sync-meta-organic` não tinham uso (tabelas vazias). `oauth-callback` era público e gravava com service role. O hub de marketing (`supabase/functions/marketing-hub`) substitui o desenho de abril com token de System User e leitura ao vivo. Para voltar a publicar alguma delas, mova a pasta de volta para `supabase/functions/` (os imports `../_shared/` dependem disso) e restaure a entrada no `config.toml`.
