-- Run with psql -v ON_ERROR_STOP=1 against a local database with the migration applied.
begin;
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %', label; end;
$$;
create function pg_temp.denied(query text) returns boolean language plpgsql as $$
begin execute query; return false; exception when insufficient_privilege then return true; end;
$$;
insert into auth.users(id, aud, role, email, raw_app_meta_data) values
('a9230000-0000-4000-8000-000000000001','authenticated','authenticated','agency-a@example.test','{"role":"AGENCY_ADMIN"}'),
('a9230000-0000-4000-8000-000000000002','authenticated','authenticated','agency-b@example.test','{"role":"AGENCY_ADMIN"}'),
('a9230000-0000-4000-8000-000000000003','authenticated','authenticated','agency-root@example.test','{"role":"NO_ADMIN"}');
insert into public.clients(id,name,slug) values
('a9230000-0000-4000-8000-000000000011','Agency test A','agency-test-a'),
('a9230000-0000-4000-8000-000000000012','Agency test B','agency-test-b');
insert into public.projects(id,client_id,name,lead_status) values
('a9230000-0000-4000-8000-000000000021','a9230000-0000-4000-8000-000000000011','Project A','ROADMAP_PAGO'),
('a9230000-0000-4000-8000-000000000022','a9230000-0000-4000-8000-000000000012','Project B','ROADMAP_PAGO');
insert into public.agencies(id,name,slug) values
('a9230000-0000-4000-8000-000000000031','Agency A','test-agency-a'),
('a9230000-0000-4000-8000-000000000032','Agency B','test-agency-b');
insert into public.agency_members(agency_id,user_id) values
('a9230000-0000-4000-8000-000000000031','a9230000-0000-4000-8000-000000000001'),
('a9230000-0000-4000-8000-000000000032','a9230000-0000-4000-8000-000000000002');
insert into public.agency_projects(agency_id,project_id) values
('a9230000-0000-4000-8000-000000000031','a9230000-0000-4000-8000-000000000021'),
('a9230000-0000-4000-8000-000000000032','a9230000-0000-4000-8000-000000000022');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a9230000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"AGENCY_ADMIN"}}',true);
select pg_temp.assert_true((select count(*)=1 from public.agencies), 'Agency A sees only its agency');
select pg_temp.assert_true((select count(*)=1 from public.agency_members), 'Agency A cannot enumerate other members');
select pg_temp.assert_true((select count(*)=1 from public.agency_projects), 'Agency A sees only its links');
select pg_temp.assert_true(public.get_agency_overview('a9230000-0000-4000-8000-000000000031')->'projects'->0->>'name'='Project A','Scoped portfolio returns A');
select pg_temp.assert_true(pg_temp.denied($q$select public.get_agency_overview('a9230000-0000-4000-8000-000000000032')$q$),'Cannot request other agency overview');
select pg_temp.assert_true(pg_temp.denied($q$select public.get_agency_project('a9230000-0000-4000-8000-000000000031','a9230000-0000-4000-8000-000000000022')$q$),'Cannot request other agency project under own ID');
select pg_temp.assert_true(public.get_agency_project('a9230000-0000-4000-8000-000000000031','a9230000-0000-4000-8000-000000000021')->'tasks'='[]'::jsonb,'Can open own project detail');
select pg_temp.assert_true((select count(*)=0 from public.projects),'No broad project table access');
select pg_temp.assert_true((select count(*)=0 from public.list_admin_projects()),'No global admin access');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.agency_members(agency_id,user_id) values ('a9230000-0000-4000-8000-000000000032','a9230000-0000-4000-8000-000000000001')$q$),'Cannot self-enroll into another agency');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.agencies(name,slug) values ('Bad','bad')$q$),'Cannot create agency as agency operator');
select set_config('request.jwt.claims','{"sub":"a9230000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"AGENCY_ADMIN"}}',true);
select pg_temp.assert_true(pg_temp.denied($q$select public.get_agency_overview('a9230000-0000-4000-8000-000000000031')$q$),'Reverse isolation: B cannot read A');
reset role;
update public.agencies set active=false where id='a9230000-0000-4000-8000-000000000032';
set local role authenticated;
select pg_temp.assert_true(pg_temp.denied($q$select public.get_agency_overview('a9230000-0000-4000-8000-000000000032')$q$),'Inactive agency loses access immediately');
select set_config('request.jwt.claims','{"sub":"a9230000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',true);
select pg_temp.assert_true(jsonb_array_length(public.get_agency_overview('a9230000-0000-4000-8000-000000000031')->'projects')=1,'NO_ADMIN retains supervision');
insert into public.agencies(name,slug) values ('Admin-created','admin-created-agency-test');
select pg_temp.assert_true((select count(*)=1 from public.agencies where slug='admin-created-agency-test'),'NO_ADMIN can manage agencies');
select set_config('request.jwt.claims','{"sub":"a9230000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"AGENCY_ADMIN"},"user_metadata":{"role":"NO_ADMIN"}}',true);
select pg_temp.assert_true(not public.is_no_admin(),'Editable metadata cannot elevate privileges');
reset role;
update public.agencies set logo_url='/agencies/test/logo.png' where id='a9230000-0000-4000-8000-000000000031';
update public.projects set access_status='ATIVO_ATE_FIM_DO_PROJETO' where id='a9230000-0000-4000-8000-000000000021';
insert into public.memberships(user_id,client_id,role) values ('a9230000-0000-4000-8000-000000000001','a9230000-0000-4000-8000-000000000011','CLIENT');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a9230000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"CLIENT"}}',true);
select pg_temp.assert_true(public.get_client_project_branding('a9230000-0000-4000-8000-000000000021')->>'logoUrl'='/agencies/test/logo.png','Client receives linked agency logo');
select pg_temp.assert_true(public.get_client_project_branding('a9230000-0000-4000-8000-000000000022') is null,'Client cannot read foreign branding');
reset role;
delete from public.agency_projects where project_id='a9230000-0000-4000-8000-000000000021';
set local role authenticated;
select pg_temp.assert_true(public.get_client_project_branding('a9230000-0000-4000-8000-000000000021') is null,'Direct client has no agency branding');
reset role;
delete from public.agency_members where user_id='a9230000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.assert_true(pg_temp.denied($q$select public.get_agency_overview('a9230000-0000-4000-8000-000000000031')$q$),'Membership revocation takes effect without token refresh');
reset role;
set local role anon;
select pg_temp.assert_true(pg_temp.denied($q$select public.get_agency_overview('a9230000-0000-4000-8000-000000000031')$q$),'Anonymous calls are forbidden');
rollback;
