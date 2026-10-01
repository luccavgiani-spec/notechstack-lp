-- Hub de marketing: os três ativos Meta da nó (Passo 1.7). Ids lidos nas
-- configurações do portfólio 990413650211777 em 30/09/2026; não são segredo.
-- O token mora no secret META_SYSTEM_USER_TOKEN, então access_token fica nulo.

insert into public.ad_accounts (client_id, platform, external_id, external_name, access_token, status)
select c.id, a.platform, a.external_id, a.external_name, null, 'active'
from public.clients as c
cross join (values
  ('meta_ads', 'act_1415926037237997', 'No Tech Stach - ADS'),
  ('meta_page', '1132533626610077', 'No Tech Stack'),
  ('meta_instagram', '17841441508079164', '@notechstack')
) as a(platform, external_id, external_name)
where c.slug = 'no-tech-stack'
on conflict (client_id, platform, external_id) do nothing;
