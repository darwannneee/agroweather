begin;
create extension if not exists pgtap with schema extensions;
select plan(221);

select has_table('public', 'weather_snapshots', 'weather snapshots exist');
select has_table('public', 'ai_generation_runs', 'generation runs exist');
select has_table('public', 'ai_generation_targets', 'generation targets exist');
select has_table('public', 'ai_task_drafts', 'AI drafts exist');

select has_column(
  'public',
  'ai_generation_targets',
  'request_payload',
  'generation targets preserve the normalized successful request'
);
select is(
  (
    select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
    from pg_catalog.pg_attribute attribute
    where attribute.attrelid =
      'public.ai_generation_targets'::regclass
      and attribute.attname = 'request_payload'
      and not attribute.attisdropped
  ),
  'jsonb',
  'generation request payload uses JSONB'
);
select col_has_check(
  'public',
  'ai_generation_targets',
  array['status', 'request_payload']::name[],
  'generation request payload shape and successful status are constrained'
);
select has_trigger(
  'public',
  'ai_generation_targets',
  'ai_generation_targets_request_payload_immutable',
  'successful generation request payloads are immutable'
);

select has_column('public', 'tasks', 'scheduled_for', 'tasks have work date');
select has_column('public', 'tasks', 'priority', 'tasks have priority');
select has_column('public', 'tasks', 'source', 'tasks have source');
select has_column('public', 'tasks', 'source_draft_id', 'tasks link to draft');
select has_column('public', 'tasks', 'ai_reason', 'tasks keep AI reason');

select has_column('public', 'task_evidence', 'attempt_number', 'evidence has attempt');
select has_column('public', 'task_evidence', 'review_status', 'evidence has review status');
select has_column('public', 'task_evidence', 'reviewed_by', 'evidence has reviewer');
select has_column('public', 'task_evidence', 'review_note', 'evidence has review note');
select has_column('public', 'task_evidence', 'reviewed_at', 'evidence has review time');
select has_column(
  'public',
  'task_evidence',
  'storage_object_id',
  'evidence links to the immutable storage object'
);
select has_column('public', 'absensi', 'attendance_date', 'attendance has Jakarta date');

select col_not_null('public', 'tasks', 'scheduled_for', 'task date is required');
select col_not_null('public', 'task_evidence', 'attempt_number', 'attempt is required');
select col_not_null('public', 'task_evidence', 'review_status', 'review status is required');
select col_not_null(
  'public',
  'task_evidence',
  'storage_object_id',
  'evidence storage object is required'
);
select col_is_fk(
  'public',
  'task_evidence',
  'storage_object_id',
  'evidence storage object is protected by a foreign key'
);
select col_not_null('public', 'absensi', 'attendance_date', 'attendance date is required');

select has_index('public', 'ai_generation_targets', 'ai_generation_targets_one_current_idx', 'one current target index exists');
select has_index('public', 'task_evidence', 'task_evidence_one_pending_idx', 'one pending evidence index exists');
select has_index('public', 'absensi', 'absensi_farmer_plot_date_idx', 'daily attendance uniqueness exists');
select has_index('public', 'tasks', 'tasks_scheduled_assignee_idx', 'daily farmer task index exists');
select ok(
  coalesce((
    select i.indisunique
    from pg_catalog.pg_index i
    join pg_catalog.pg_class index_class on index_class.oid = i.indexrelid
    join pg_catalog.pg_class table_class on table_class.oid = i.indrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public'
      and table_class.relname = 'ai_generation_targets'
      and index_class.relname = 'ai_generation_targets_one_current_idx'
  ), false),
  'current target index is unique'
);
select ok(
  coalesce((
    select i.indpred is not null
    from pg_catalog.pg_index i
    join pg_catalog.pg_class index_class on index_class.oid = i.indexrelid
    join pg_catalog.pg_class table_class on table_class.oid = i.indrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public'
      and table_class.relname = 'ai_generation_targets'
      and index_class.relname = 'ai_generation_targets_one_current_idx'
  ), false),
  'current target index is partial'
);
select ok(
  coalesce((
    select i.indisunique
    from pg_catalog.pg_index i
    join pg_catalog.pg_class index_class on index_class.oid = i.indexrelid
    join pg_catalog.pg_class table_class on table_class.oid = i.indrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public'
      and table_class.relname = 'task_evidence'
      and index_class.relname = 'task_evidence_one_pending_idx'
  ), false),
  'pending evidence index is unique'
);
select ok(
  coalesce((
    select i.indpred is not null
    from pg_catalog.pg_index i
    join pg_catalog.pg_class index_class on index_class.oid = i.indexrelid
    join pg_catalog.pg_class table_class on table_class.oid = i.indrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public'
      and table_class.relname = 'task_evidence'
      and index_class.relname = 'task_evidence_one_pending_idx'
  ), false),
  'pending evidence index is partial'
);

select col_has_check('public', 'ai_task_drafts', 'status', 'draft status is constrained');
select col_has_check('public', 'ai_task_drafts', 'priority', 'draft priority is constrained');
select col_has_check('public', 'task_evidence', 'review_status', 'review status is constrained');
select col_has_check('public', 'tasks', 'priority', 'task priority is constrained');
select col_has_check('public', 'tasks', 'source', 'task source is constrained');

select has_function(
  'public',
  'current_user_role',
  array[]::text[],
  'current user role helper exists'
);
select has_function(
  'public',
  'is_internal',
  array[]::text[],
  'internal-role helper exists'
);
select has_function(
  'public',
  'replace_ai_task_drafts',
  array['uuid', 'uuid', 'date', 'uuid', 'text', 'text', 'jsonb'],
  'replace draft RPC exists'
);
select has_function(
  'public',
  'record_ai_generation_target',
  array['uuid', 'uuid', 'date', 'text', 'text', 'text', 'uuid'],
  'record skipped or failed generation target RPC exists'
);
select has_function(
  'public',
  'approve_ai_task_draft',
  array['uuid', 'uuid', 'text', 'text', 'text', 'boolean'],
  'approve draft RPC exists'
);
select has_function(
  'public',
  'bulk_approve_ai_task_drafts',
  array['uuid[]'],
  'bulk approve draft RPC exists'
);
select has_function(
  'public',
  'reject_ai_task_draft',
  array['uuid', 'text'],
  'reject draft RPC exists'
);
select has_function(
  'public',
  'start_assigned_task',
  array['uuid'],
  'start task RPC exists'
);
select has_function(
  'public',
  'register_attendance',
  array['uuid', 'numeric', 'numeric'],
  'server-validated attendance RPC exists'
);
select has_function(
  'public',
  'register_task_evidence',
  array['uuid', 'text', 'text', 'numeric', 'numeric', 'text'],
  'register evidence RPC exists'
);
select has_function(
  'public',
  'review_task_evidence',
  array['uuid', 'text', 'text'],
  'review evidence RPC exists'
);

select is(
  (
    select function_definition.proargnames[6]
    from pg_catalog.pg_proc function_definition
    where function_definition.oid =
      'public.register_task_evidence(uuid,text,text,numeric,numeric,text)'
        ::regprocedure
  ),
  'p_ai_placeholder_summary',
  'evidence RPC exposes the documented AI placeholder argument name'
);

with expected_function(signature) as (
  values
    ('public.current_user_role()'),
    ('public.is_internal()'),
    ('public.replace_ai_task_drafts(uuid,uuid,date,uuid,text,text,jsonb)'),
    ('public.record_ai_generation_target(uuid,uuid,date,text,text,text,uuid)'),
    ('public.approve_ai_task_draft(uuid,uuid,text,text,text,boolean)'),
    ('public.bulk_approve_ai_task_drafts(uuid[])'),
    ('public.reject_ai_task_draft(uuid,text)'),
    ('public.start_assigned_task(uuid)'),
    ('public.register_attendance(uuid,numeric,numeric)'),
    ('public.register_task_evidence(uuid,text,text,numeric,numeric,text)'),
    ('public.review_task_evidence(uuid,text,text)')
)
select ok(
  pg_catalog.count(*) = 11
    and pg_catalog.bool_and(function_definition.prosecdef),
  'all operational RPCs are SECURITY DEFINER'
)
from expected_function
join pg_catalog.pg_proc function_definition
  on function_definition.oid = expected_function.signature::regprocedure;

with expected_function(signature) as (
  values
    ('public.current_user_role()'),
    ('public.is_internal()'),
    ('public.replace_ai_task_drafts(uuid,uuid,date,uuid,text,text,jsonb)'),
    ('public.record_ai_generation_target(uuid,uuid,date,text,text,text,uuid)'),
    ('public.approve_ai_task_draft(uuid,uuid,text,text,text,boolean)'),
    ('public.bulk_approve_ai_task_drafts(uuid[])'),
    ('public.reject_ai_task_draft(uuid,text)'),
    ('public.start_assigned_task(uuid)'),
    ('public.register_attendance(uuid,numeric,numeric)'),
    ('public.register_task_evidence(uuid,text,text,numeric,numeric,text)'),
    ('public.review_task_evidence(uuid,text,text)')
)
select ok(
  pg_catalog.count(*) = 11
    and pg_catalog.bool_and(
      function_definition.proconfig = array['search_path=""']::text[]
    ),
  'all operational RPCs pin an exactly empty search path'
)
from expected_function
join pg_catalog.pg_proc function_definition
  on function_definition.oid = expected_function.signature::regprocedure;

with function_definition(sql) as (
  select pg_catalog.lower(
    pg_catalog.pg_get_functiondef(
      'public.approve_ai_task_draft(uuid,uuid,text,text,text,boolean)'
        ::regprocedure
    )
  )
)
select ok(
  sql ~
    'from public[.]lahan plot[[:space:]]+where plot[.]id = draft[.]lahan_id[[:space:]]+for share;'
    and sql ~
      'from public[.]users farmer[[:space:]]+where farmer[.]id = p_assignee_id[[:space:]]+for share;',
  'draft approval separately locks the active plot and selected assignee'
)
from function_definition;

select ok(
  pg_catalog.lower(
    pg_catalog.pg_get_functiondef(
      'public.register_task_evidence(uuid,text,text,numeric,numeric,text)'
        ::regprocedure
    )
  ) ~
    'from storage[.]objects object[[:space:]]+where object[.]bucket_id = ''task-evidence''[[:space:]]+and object[.]name = normalized_path[[:space:]]+for key share;',
  'evidence registration holds a key-share lock on the exact storage object'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.current_user_role()',
    'EXECUTE'
  ),
  'authenticated can resolve its operational role'
);
select ok(
  not has_function_privilege('anon', 'public.current_user_role()', 'EXECUTE'),
  'anon cannot resolve an operational role'
);
select ok(
  has_function_privilege('authenticated', 'public.is_internal()', 'EXECUTE'),
  'authenticated can use the internal-role helper'
);
select ok(
  not has_function_privilege('anon', 'public.is_internal()', 'EXECUTE'),
  'anon cannot use the internal-role helper'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.replace_ai_task_drafts(uuid,uuid,date,uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'service role can replace AI drafts'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_definition
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function_definition.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        function_definition.proacl,
        pg_catalog.acldefault('f', function_definition.proowner)
      )
    ) privilege
    where namespace.nspname = 'public'
      and function_definition.oid =
        'public.replace_ai_task_drafts(uuid,uuid,date,uuid,text,text,jsonb)'
          ::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot replace AI drafts'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.replace_ai_task_drafts(uuid,uuid,date,uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot replace AI drafts'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.replace_ai_task_drafts(uuid,uuid,date,uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'anon cannot replace AI drafts'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.record_ai_generation_target(uuid,uuid,date,text,text,text,uuid)',
    'EXECUTE'
  ),
  'service role can record generation failures'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_definition
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function_definition.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        function_definition.proacl,
        pg_catalog.acldefault('f', function_definition.proowner)
      )
    ) privilege
    where namespace.nspname = 'public'
      and function_definition.oid =
        'public.record_ai_generation_target(uuid,uuid,date,text,text,text,uuid)'
          ::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot record generation failures'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_ai_generation_target(uuid,uuid,date,text,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot record generation failures'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.record_ai_generation_target(uuid,uuid,date,text,text,text,uuid)',
    'EXECUTE'
  ),
  'anon cannot record generation failures'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.approve_ai_task_draft(uuid,uuid,text,text,text,boolean)',
    'EXECUTE'
  ),
  'authenticated can invoke approve with server authorization'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.approve_ai_task_draft(uuid,uuid,text,text,text,boolean)',
    'EXECUTE'
  ),
  'anon cannot invoke approve'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.bulk_approve_ai_task_drafts(uuid[])',
    'EXECUTE'
  ),
  'authenticated can invoke bulk approval with server authorization'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.bulk_approve_ai_task_drafts(uuid[])',
    'EXECUTE'
  ),
  'anon cannot invoke bulk approval'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.reject_ai_task_draft(uuid,text)',
    'EXECUTE'
  ),
  'authenticated can invoke rejection with server authorization'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.reject_ai_task_draft(uuid,text)',
    'EXECUTE'
  ),
  'anon cannot invoke rejection'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.start_assigned_task(uuid)',
    'EXECUTE'
  ),
  'authenticated can invoke task start with server authorization'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.start_assigned_task(uuid)',
    'EXECUTE'
  ),
  'anon cannot invoke task start'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.register_attendance(uuid,numeric,numeric)',
    'EXECUTE'
  ),
  'authenticated can invoke attendance with server authorization'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.register_attendance(uuid,numeric,numeric)',
    'EXECUTE'
  ),
  'anon cannot invoke attendance'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.register_task_evidence(uuid,text,text,numeric,numeric,text)',
    'EXECUTE'
  ),
  'authenticated can invoke evidence registration with server authorization'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.register_task_evidence(uuid,text,text,numeric,numeric,text)',
    'EXECUTE'
  ),
  'anon cannot invoke evidence registration'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.review_task_evidence(uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated can invoke evidence review with server authorization'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.review_task_evidence(uuid,text,text)',
    'EXECUTE'
  ),
  'anon cannot invoke evidence review'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) values
  (
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'task3-internal@example.test',
    'not-used',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'task3-farmer-a@example.test',
    'not-used',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'task3-farmer-b@example.test',
    'not-used',
    now(),
    now(),
    now()
  );

insert into public.users (id, nama, email, role) values
  (
    '10000000-0000-0000-0000-000000000001',
    'Internal Task 3',
    'task3-internal@example.test',
    'internal'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Farmer A Task 3',
    'task3-farmer-a@example.test',
    'farmer'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Farmer B Task 3',
    'task3-farmer-b@example.test',
    'farmer'
  );

insert into public.lahan (
  id,
  nama_lahan,
  farmer_id,
  jenis_tanaman,
  lat_center,
  lng_center,
  radius_geofence_m,
  status
) values
  (
    '20000000-0000-0000-0000-000000000001',
    'Plot A Task 3',
    '10000000-0000-0000-0000-000000000002',
    'Padi',
    -6.200000,
    106.816666,
    200,
    'aktif'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Plot B Task 3',
    '10000000-0000-0000-0000-000000000003',
    'Jagung',
    -6.210000,
    106.826666,
    200,
    'aktif'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'Inactive Plot Task 3',
    '10000000-0000-0000-0000-000000000002',
    'Cabai',
    -6.220000,
    106.836666,
    200,
    'nonaktif'
  );

insert into public.weather_snapshots (
  id,
  lahan_id,
  observed_at,
  expires_at,
  current_data,
  forecast_data
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    now(),
    now() + interval '6 hours',
    '{"temp": 29}'::jsonb,
    '[]'::jsonb
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    now(),
    now() + interval '6 hours',
    '{"temp": 28}'::jsonb,
    '[]'::jsonb
  );

insert into public.ai_generation_runs (
  id,
  trigger,
  scheduled_for,
  status,
  model,
  plot_count
) values
  (
    '40000000-0000-0000-0000-000000000001',
    'cron',
    (now() at time zone 'Asia/Jakarta')::date,
    'running',
    'test/model',
    1
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    'manual',
    (now() at time zone 'Asia/Jakarta')::date,
    'running',
    'test/model',
    1
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    'manual',
    (now() at time zone 'Asia/Jakarta')::date,
    'running',
    'test/model',
    1
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    'manual',
    (now() at time zone 'Asia/Jakarta')::date,
    'running',
    'test/model',
    1
  );

insert into public.ai_generation_targets (
  id,
  run_id,
  lahan_id,
  scheduled_for,
  version,
  status,
  draft_count,
  weather_snapshot_id,
  request_payload
) values (
  '50000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  (now() at time zone 'Asia/Jakarta')::date,
  1,
  'succeeded',
  1,
  '30000000-0000-0000-0000-000000000001',
  '{
    "model": "test/model",
    "result_summary": null,
    "drafts": [
      {
        "judul": "Draft lama",
        "deskripsi": "Draft lama yang harus digantikan.",
        "priority": "medium",
        "requires_location": true,
        "ai_reason": "Digantikan oleh hasil generasi terbaru."
      }
    ]
  }'::jsonb
);

insert into public.ai_task_drafts (
  id,
  generation_target_id,
  lahan_id,
  proposed_assignee_id,
  scheduled_for,
  judul,
  deskripsi,
  priority,
  requires_location,
  ai_reason,
  model,
  weather_snapshot_id,
  status,
  rejection_reason
) values
  (
    '60000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    (now() at time zone 'Asia/Jakarta')::date,
    'Draft lama',
    'Draft lama yang harus digantikan.',
    'medium',
    true,
    'Digantikan oleh hasil generasi terbaru.',
    'test/model',
    '30000000-0000-0000-0000-000000000001',
    'pending',
    null
  ),
  (
    '60000000-0000-0000-0000-000000000010',
    '50000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    (now() at time zone 'Asia/Jakarta')::date,
    'Draft historis disetujui',
    'Draft historis ini tidak boleh diubah saat regenerasi.',
    'medium',
    false,
    'Riwayat persetujuan harus tetap dapat diaudit.',
    'test/model',
    '30000000-0000-0000-0000-000000000001',
    'approved',
    null
  ),
  (
    '60000000-0000-0000-0000-000000000011',
    '50000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    (now() at time zone 'Asia/Jakarta')::date,
    'Draft historis ditolak',
    'Draft historis ini juga tidak boleh diubah saat regenerasi.',
    'low',
    false,
    'Riwayat penolakan harus tetap dapat diaudit.',
    'test/model',
    '30000000-0000-0000-0000-000000000001',
    'rejected',
    'Tidak sesuai kondisi saat itu.'
  );

set local role service_role;

select throws_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Terlalu banyak draft',
      '[
        {"judul":"Tugas 1","deskripsi":"Deskripsi tugas pertama.","priority":"low","requires_location":true,"ai_reason":"Alasan tugas pertama."},
        {"judul":"Tugas 2","deskripsi":"Deskripsi tugas kedua.","priority":"low","requires_location":true,"ai_reason":"Alasan tugas kedua."},
        {"judul":"Tugas 3","deskripsi":"Deskripsi tugas ketiga.","priority":"medium","requires_location":true,"ai_reason":"Alasan tugas ketiga."},
        {"judul":"Tugas 4","deskripsi":"Deskripsi tugas keempat.","priority":"medium","requires_location":false,"ai_reason":"Alasan tugas keempat."},
        {"judul":"Tugas 5","deskripsi":"Deskripsi tugas kelima.","priority":"high","requires_location":true,"ai_reason":"Alasan tugas kelima."},
        {"judul":"Tugas 6","deskripsi":"Deskripsi tugas keenam.","priority":"high","requires_location":true,"ai_reason":"Alasan tugas keenam."}
      ]'::jsonb
    )
  $$,
  'P0001',
  'AI_DRAFT_LIMIT',
  'generation rejects more than five drafts'
);

select throws_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Tidak ada draft',
      '[]'::jsonb
    )
  $$,
  'P0001',
  'AI_DRAFT_LIMIT',
  'generation rejects empty draft output'
);

select lives_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Dua draft baru',
      '[
        {"judul":"Cek drainase","deskripsi":"Periksa seluruh saluran drainase lahan.","priority":"high","requires_location":true,"ai_reason":"Hujan diperkirakan meningkat."},
        {"judul":"Pantau daun","deskripsi":"Amati kondisi daun dan catat perubahan warna.","priority":"medium","requires_location":false,"ai_reason":"Kelembapan cukup tinggi hari ini."}
      ]'::jsonb
    )
  $$,
  'service role can atomically replace current drafts'
);

select lives_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Dua draft baru',
      '[
        {"judul":"Cek drainase","deskripsi":"Periksa seluruh saluran drainase lahan.","priority":"high","requires_location":true,"ai_reason":"Hujan diperkirakan meningkat."},
        {"judul":"Pantau daun","deskripsi":"Amati kondisi daun dan catat perubahan warna.","priority":"medium","requires_location":false,"ai_reason":"Kelembapan cukup tinggi hari ini."}
      ]'::jsonb
    )
  $$,
  'a retry for the same run and plot is idempotent'
);

reset role;
update public.ai_generation_runs
set status = 'succeeded'
where id = '40000000-0000-0000-0000-000000000002';
set local role service_role;

select lives_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Dua draft baru',
      '[
        {"judul":"Cek drainase","deskripsi":"Periksa seluruh saluran drainase lahan.","priority":"high","requires_location":true,"ai_reason":"Hujan diperkirakan meningkat."},
        {"judul":"Pantau daun","deskripsi":"Amati kondisi daun dan catat perubahan warna.","priority":"medium","requires_location":false,"ai_reason":"Kelembapan cukup tinggi hari ini."}
      ]'::jsonb
    )
  $$,
  'exact retry remains idempotent after the run becomes terminal'
);

select lives_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Dua draft baru',
      '[
        {"judul":"Pantau daun","deskripsi":"Amati kondisi daun dan catat perubahan warna.","priority":"medium","requires_location":false,"ai_reason":"Kelembapan cukup tinggi hari ini."},
        {"judul":"Cek drainase","deskripsi":"Periksa seluruh saluran drainase lahan.","priority":"high","requires_location":true,"ai_reason":"Hujan diperkirakan meningkat."}
      ]'::jsonb
    )
  $$,
  'canonical retry ignores draft array order'
);
select throws_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Dua draft baru',
      '[
        {"judul":"Cek drainase","deskripsi":"Periksa seluruh saluran drainase lahan.","priority":"high","requires_location":true,"ai_reason":"Hujan diperkirakan meningkat."},
        {"judul":"Cek drainase","deskripsi":"Periksa seluruh saluran drainase lahan.","priority":"high","requires_location":true,"ai_reason":"Hujan diperkirakan meningkat."}
      ]'::jsonb
    )
  $$,
  'P0001',
  'GENERATION_RETRY_MISMATCH',
  'canonical retry preserves duplicate draft multiplicity'
);
select throws_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Ringkasan retry telah berubah',
      '[
        {"judul":"Cek drainase","deskripsi":"Periksa seluruh saluran drainase lahan.","priority":"high","requires_location":true,"ai_reason":"Hujan diperkirakan meningkat."},
        {"judul":"Pantau daun","deskripsi":"Amati kondisi daun dan catat perubahan warna.","priority":"medium","requires_location":false,"ai_reason":"Kelembapan cukup tinggi hari ini."}
      ]'::jsonb
    )
  $$,
  'P0001',
  'GENERATION_RETRY_MISMATCH',
  'canonical retry rejects a changed result summary'
);
select throws_ok(
  $$
    update public.ai_generation_targets
    set request_payload = pg_catalog.jsonb_set(
      request_payload,
      '{model}',
      '"rewritten/model"'::jsonb
    )
    where run_id = '40000000-0000-0000-0000-000000000002'
      and lahan_id = '20000000-0000-0000-0000-000000000001'
  $$,
  'P0001',
  'GENERATION_REQUEST_PAYLOAD_IMMUTABLE',
  'successful request payload cannot be rewritten directly'
);
select throws_ok(
  $$
    update public.ai_generation_targets
    set status = 'failed',
        request_payload = null,
        error_code = 'REWRITTEN'
    where run_id = '40000000-0000-0000-0000-000000000002'
      and lahan_id = '20000000-0000-0000-0000-000000000001'
  $$,
  'P0001',
  'GENERATION_REQUEST_PAYLOAD_IMMUTABLE',
  'successful request payload cannot be cleared through a status rewrite'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.approve_ai_task_draft(
      (
        select draft.id
        from public.ai_task_drafts draft
        join public.ai_generation_targets target
          on target.id = draft.generation_target_id
        where target.run_id =
          '40000000-0000-0000-0000-000000000002'
          and draft.judul = 'Cek drainase'
      ),
      '10000000-0000-0000-0000-000000000002',
      'Cek drainase disetujui',
      'Periksa saluran drainase dan laporkan hasil prioritas.',
      'medium',
      false
    )
  $$,
  'internal can approve a generated draft with operational edits'
);
select is(
  (
    select draft.judul
    from public.ai_task_drafts draft
    join public.ai_generation_targets target
      on target.id = draft.generation_target_id
    where target.run_id = '40000000-0000-0000-0000-000000000002'
      and draft.status = 'approved'
  ),
  'Cek drainase disetujui',
  'approval persists edits without changing the original request identity'
);

reset role;
set local role service_role;

select lives_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Dua draft baru',
      '[
        {"judul":"Cek drainase","deskripsi":"Periksa seluruh saluran drainase lahan.","priority":"high","requires_location":true,"ai_reason":"Hujan diperkirakan meningkat."},
        {"judul":"Pantau daun","deskripsi":"Amati kondisi daun dan catat perubahan warna.","priority":"medium","requires_location":false,"ai_reason":"Kelembapan cukup tinggi hari ini."}
      ]'::jsonb
    )
  $$,
  'exact retry remains idempotent after an approved draft is edited'
);

select throws_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Dua draft baru',
      '[
        {"judul":"Tugas berbeda","deskripsi":"Payload berbeda dengan jumlah draft yang sama.","priority":"high","requires_location":true,"ai_reason":"Retry ini bukan payload asli."},
        {"judul":"Pantau gulma","deskripsi":"Periksa pertumbuhan gulma di seluruh petak.","priority":"medium","requires_location":false,"ai_reason":"Payload retry telah berubah."}
      ]'::jsonb
    )
  $$,
  'P0001',
  'GENERATION_RETRY_MISMATCH',
  'same-count retry rejects a different normalized draft payload'
);

select throws_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000001',
      'test/model',
      'Dua draft baru',
      '[
        {"judul":"x","deskripsi":"Payload invalid tidak boleh lolos retry.","priority":"high","requires_location":true,"ai_reason":"Judul terlalu pendek."},
        {"judul":"Pantau daun","deskripsi":"Amati kondisi daun dan catat perubahan warna.","priority":"medium","requires_location":false,"ai_reason":"Kelembapan cukup tinggi hari ini."}
      ]'::jsonb
    )
  $$,
  'P0001',
  'AI_DRAFT_INVALID',
  'retry validates every incoming draft before idempotent return'
);

reset role;

select is(
  (
    select status
    from public.ai_task_drafts
    where id = '60000000-0000-0000-0000-000000000001'
  ),
  'superseded',
  'replacement supersedes only the prior pending draft'
);
select is(
  (
    select status
    from public.ai_task_drafts
    where id = '60000000-0000-0000-0000-000000000010'
  ),
  'approved',
  'replacement preserves approved historical drafts'
);
select is(
  (
    select status
    from public.ai_task_drafts
    where id = '60000000-0000-0000-0000-000000000011'
  ),
  'rejected',
  'replacement preserves rejected historical drafts'
);
select is(
  (
    select version
    from public.ai_generation_targets
    where lahan_id = '20000000-0000-0000-0000-000000000001'
      and is_current
  ),
  2,
  'replacement creates the next current target version'
);
select is(
  (
    select draft_count
    from public.ai_generation_targets
    where lahan_id = '20000000-0000-0000-0000-000000000001'
      and is_current
  ),
  2,
  'replacement records the exact draft count'
);
select is(
  (
    select count(distinct proposed_assignee_id)
    from public.ai_task_drafts
    where generation_target_id = (
      select id
      from public.ai_generation_targets
      where lahan_id = '20000000-0000-0000-0000-000000000001'
        and is_current
    )
  ),
  1::bigint,
  'replacement derives one assignee from the active plot'
);
select is(
  (
    select proposed_assignee_id
    from public.ai_task_drafts
    where generation_target_id = (
      select id
      from public.ai_generation_targets
      where lahan_id = '20000000-0000-0000-0000-000000000001'
        and is_current
    )
    order by id
    limit 1
  ),
  '10000000-0000-0000-0000-000000000002'::uuid,
  'replacement uses the plot farmer as proposed assignee'
);

set local role service_role;

select throws_ok(
  $$
    select public.record_ai_generation_target(
      '40000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000002',
      (now() at time zone 'Asia/Jakarta')::date,
      'succeeded',
      null,
      'Status tidak valid untuk helper ini',
      '30000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'GENERATION_TARGET_STATUS_INVALID',
  'failure recorder only accepts skipped or failed'
);

select lives_ok(
  $$
    select public.record_ai_generation_target(
      '40000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000002',
      (now() at time zone 'Asia/Jakarta')::date,
      'failed',
      'OPENROUTER_TIMEOUT',
      'Provider tidak merespons tepat waktu.',
      '30000000-0000-0000-0000-000000000002'
    )
  $$,
  'service role records a failed generation target'
);

select lives_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000004',
      '20000000-0000-0000-0000-000000000002',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000002',
      'test/model',
      'Tidak ada task yang perlu dibuat.',
      '[]'::jsonb
    )
  $$,
  'generation can persist an intentional zero-draft result'
);
select throws_ok(
  $$
    select public.replace_ai_task_drafts(
      '40000000-0000-0000-0000-000000000004',
      '20000000-0000-0000-0000-000000000002',
      (now() at time zone 'Asia/Jakarta')::date,
      '30000000-0000-0000-0000-000000000002',
      'other/model',
      'Tidak ada task yang perlu dibuat.',
      '[]'::jsonb
    )
  $$,
  'P0001',
  'GENERATION_RETRY_MISMATCH',
  'zero-draft retry still verifies the normalized model'
);

reset role;

select is(
  (
    select status
    from public.ai_generation_targets
    where run_id = '40000000-0000-0000-0000-000000000003'
      and lahan_id = '20000000-0000-0000-0000-000000000002'
  ),
  'failed',
  'failure recorder persists the requested terminal status'
);
select ok(
  not exists (
    select 1
    from public.ai_generation_targets target
    where (target.status = 'succeeded')
      is distinct from (target.request_payload is not null)
  ),
  'only successful targets preserve a request payload'
);

insert into public.ai_task_drafts (
  id,
  generation_target_id,
  lahan_id,
  proposed_assignee_id,
  scheduled_for,
  judul,
  deskripsi,
  priority,
  requires_location,
  ai_reason,
  model,
  weather_snapshot_id
) values
  (
    '60000000-0000-0000-0000-000000000002',
    (
      select id
      from public.ai_generation_targets
      where lahan_id = '20000000-0000-0000-0000-000000000001'
        and is_current
    ),
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    (now() at time zone 'Asia/Jakarta')::date,
    'Setujui draft tunggal',
    'Draft ini dipakai untuk menguji persetujuan tunggal.',
    'high',
    true,
    'Kondisi cuaca membutuhkan pemeriksaan langsung.',
    'test/model',
    '30000000-0000-0000-0000-000000000001'
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    (
      select id
      from public.ai_generation_targets
      where lahan_id = '20000000-0000-0000-0000-000000000001'
        and is_current
    ),
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    (now() at time zone 'Asia/Jakarta')::date,
    'Setujui bulk pertama',
    'Draft pertama untuk menguji persetujuan secara bulk.',
    'medium',
    true,
    'Pekerjaan perlu dilakukan pada hari yang sama.',
    'test/model',
    '30000000-0000-0000-0000-000000000001'
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    (
      select id
      from public.ai_generation_targets
      where lahan_id = '20000000-0000-0000-0000-000000000001'
        and is_current
    ),
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    (now() at time zone 'Asia/Jakarta')::date,
    'Setujui bulk kedua',
    'Draft kedua untuk menguji persetujuan secara bulk.',
    'low',
    false,
    'Pencatatan visual dapat dilakukan tanpa lokasi.',
    'test/model',
    '30000000-0000-0000-0000-000000000001'
  ),
  (
    '60000000-0000-0000-0000-000000000005',
    (
      select id
      from public.ai_generation_targets
      where lahan_id = '20000000-0000-0000-0000-000000000001'
        and is_current
    ),
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    (now() at time zone 'Asia/Jakarta')::date,
    'Draft stale',
    'Draft stale untuk memastikan seluruh operasi bulk dibatalkan.',
    'medium',
    true,
    'Draft ini sudah ditolak sebelum bulk dijalankan.',
    'test/model',
    '30000000-0000-0000-0000-000000000001'
  ),
  (
    '60000000-0000-0000-0000-000000000006',
    (
      select id
      from public.ai_generation_targets
      where lahan_id = '20000000-0000-0000-0000-000000000001'
        and is_current
    ),
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    (now() at time zone 'Asia/Jakarta')::date,
    'Draft untuk ditolak',
    'Draft ini digunakan untuk menguji alasan penolakan.',
    'low',
    false,
    'Rekomendasi tidak lagi sesuai kondisi operasional.',
    'test/model',
    '30000000-0000-0000-0000-000000000001'
  ),
  (
    '60000000-0000-0000-0000-000000000007',
    (
      select id
      from public.ai_generation_targets
      where lahan_id = '20000000-0000-0000-0000-000000000001'
        and is_current
    ),
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    (now() at time zone 'Asia/Jakarta')::date,
    'Draft assignee invalid',
    'Draft kedua memaksa kegagalan setelah insert bulk pertama.',
    'medium',
    true,
    'Assignee internal tidak boleh menerima task petani.',
    'test/model',
    '30000000-0000-0000-0000-000000000001'
  );

update public.ai_task_drafts
set status = 'rejected',
    rejection_reason = 'Sudah tidak relevan'
where id = '60000000-0000-0000-0000-000000000005';

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select public.approve_ai_task_draft(
      '60000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002',
      'Setujui draft tunggal',
      'Draft ini dipakai untuk menguji persetujuan tunggal.',
      'high',
      true
    )
  $$,
  'P0001',
  'INTERNAL_REQUIRED',
  'farmer cannot approve an AI draft'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.approve_ai_task_draft(
      '60000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002',
      'Setujui draft tunggal',
      'Draft ini dipakai untuk menguji persetujuan tunggal.',
      'high',
      true
    )
  $$,
  'internal user can approve one pending draft'
);

select is(
  (
    select count(*)
    from public.tasks
    where source_draft_id = '60000000-0000-0000-0000-000000000002'
      and source = 'ai'
      and assigned_by = '10000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'single approval creates and links exactly one AI task'
);

select throws_ok(
  $$
    select public.approve_ai_task_draft(
      '60000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002',
      'Setujui draft tunggal',
      'Draft ini dipakai untuk menguji persetujuan tunggal.',
      'high',
      true
    )
  $$,
  'P0001',
  'DRAFT_NOT_PENDING',
  'single approval rejects a double submit'
);

select throws_ok(
  $$
    select public.bulk_approve_ai_task_drafts(
      array[
        '60000000-0000-0000-0000-000000000003'::uuid,
        '60000000-0000-0000-0000-000000000007'::uuid
      ]
    )
  $$,
  'P0001',
  'ASSIGNEE_NOT_FARMER',
  'bulk approval rolls back when a later transition fails'
);

select is(
  (
    select count(*)
    from public.tasks
    where source_draft_id in (
      '60000000-0000-0000-0000-000000000003',
      '60000000-0000-0000-0000-000000000007'
    )
  ),
  0::bigint,
  'late bulk failure rolls back every task insert'
);
select is(
  (
    select count(*)
    from public.ai_task_drafts
    where id in (
      '60000000-0000-0000-0000-000000000003',
      '60000000-0000-0000-0000-000000000007'
    )
      and status = 'pending'
  ),
  2::bigint,
  'late bulk failure leaves every selected draft pending'
);

select throws_ok(
  $$
    select public.bulk_approve_ai_task_drafts(
      array[
        '60000000-0000-0000-0000-000000000003'::uuid,
        '60000000-0000-0000-0000-000000000003'::uuid
      ]
    )
  $$,
  'P0001',
  'DRAFT_SELECTION_DUPLICATE',
  'bulk approval rejects duplicate IDs before writing'
);

create temporary table task3_bulk_result (
  task_ids uuid[] not null
) on commit drop;

insert into task3_bulk_result (task_ids)
select public.bulk_approve_ai_task_drafts(
    array[
      '60000000-0000-0000-0000-000000000004'::uuid,
      '60000000-0000-0000-0000-000000000003'::uuid
    ]
  );

select is(
  (select task_ids from task3_bulk_result),
  array[
    (
      select created_task_id
      from public.ai_task_drafts
      where id = '60000000-0000-0000-0000-000000000004'
    ),
    (
      select created_task_id
      from public.ai_task_drafts
      where id = '60000000-0000-0000-0000-000000000003'
    )
  ],
  'bulk approval returns task IDs in selected input order'
);

select is(
  (
    select count(*)
    from public.tasks
    where source_draft_id in (
      '60000000-0000-0000-0000-000000000003',
      '60000000-0000-0000-0000-000000000004'
    )
  ),
  2::bigint,
  'bulk approval creates exactly one task per pending draft'
);

select throws_ok(
  $$
    select public.reject_ai_task_draft(
      '60000000-0000-0000-0000-000000000006',
      'x'
    )
  $$,
  'P0001',
  'REJECTION_REASON_INVALID',
  'draft rejection requires a bounded reason'
);

select lives_ok(
  $$
    select public.reject_ai_task_draft(
      '60000000-0000-0000-0000-000000000006',
      'Tidak sesuai kondisi terbaru.'
    )
  $$,
  'internal user can reject one pending draft'
);

select is(
  (
    select status
    from public.ai_task_drafts
    where id = '60000000-0000-0000-0000-000000000006'
  ),
  'rejected',
  'draft rejection persists the terminal status'
);

reset role;

insert into public.tasks (
  id,
  lahan_id,
  assigned_to,
  assigned_by,
  judul,
  deskripsi,
  status,
  scheduled_for,
  requires_location
) values
  (
    '70000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Task bukti lokasi',
    'Task untuk menguji alur bukti dengan lokasi.',
    'belum_dikerjakan',
    (now() at time zone 'Asia/Jakarta')::date,
    true
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Task tanpa lokasi',
    'Task untuk menguji transisi mulai.',
    'belum_dikerjakan',
    (now() at time zone 'Asia/Jakarta')::date,
    false
  );

insert into storage.objects (bucket_id, name, owner, owner_id) values
  (
    'task-evidence',
    '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/attempt-1.jpg',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002'
  ),
  (
    'task-evidence',
    '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/attempt-2.png',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002'
  );

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select public.register_attendance(
      '20000000-0000-0000-0000-000000000001',
      -6.200000,
      106.816666
    )
  $$,
  'P0001',
  'FARMER_REQUIRED',
  'attendance rejects authenticated requests without a subject'
);
select throws_ok(
  $$
    select public.start_assigned_task(
      '70000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'FARMER_REQUIRED',
  'task start rejects authenticated requests without a subject'
);
select throws_ok(
  $$
    select public.register_task_evidence(
      '70000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/attempt-1.jpg',
      'Tidak boleh diterima tanpa sub.',
      -6.200000,
      106.816666,
      null
    )
  $$,
  'P0001',
  'FARMER_REQUIRED',
  'evidence registration rejects authenticated requests without a subject'
);
select throws_ok(
  $$
    select public.register_task_evidence(
      p_task_id => '70000000-0000-0000-0000-000000000001',
      p_photo_path => '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/attempt-1.jpg',
      p_note => 'Named argument contract.',
      p_lat => -6.200000,
      p_lng => 106.816666,
      p_ai_placeholder_summary => null
    )
  $$,
  'P0001',
  'FARMER_REQUIRED',
  'evidence RPC accepts the documented named arguments'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select public.start_assigned_task(
      '70000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'TASK_NOT_ASSIGNED',
  'farmer cannot start another farmer task'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (public.start_assigned_task(
    '70000000-0000-0000-0000-000000000002'
  )).status,
  'sedang_dikerjakan'::public.task_status,
  'assigned farmer can start its task'
);
select ok(
  (
    select unlocked_at is not null
    from public.tasks
    where id = '70000000-0000-0000-0000-000000000002'
  ),
  'starting a task records its first unlock time'
);

select lives_ok(
  $$
    select public.register_attendance(
      '20000000-0000-0000-0000-000000000001',
      -6.200000,
      106.816666
    )
  $$,
  'owned farmer can register attendance inside the geofence'
);

select is(
  (
    select farmer_id
    from public.absensi
    where lahan_id = '20000000-0000-0000-0000-000000000001'
      and attendance_date = (now() at time zone 'Asia/Jakarta')::date
  ),
  '10000000-0000-0000-0000-000000000002'::uuid,
  'attendance derives farmer from auth.uid'
);
select is(
  (
    select attendance_date
    from public.absensi
    where lahan_id = '20000000-0000-0000-0000-000000000001'
      and farmer_id = '10000000-0000-0000-0000-000000000002'
  ),
  (statement_timestamp() at time zone 'Asia/Jakarta')::date,
  'attendance derives its Jakarta date server-side'
);
select ok(
  (
    select waktu_masuk between transaction_timestamp() and statement_timestamp()
    from public.absensi
    where lahan_id = '20000000-0000-0000-0000-000000000001'
      and farmer_id = '10000000-0000-0000-0000-000000000002'
  ),
  'attendance derives its timestamp server-side'
);
select ok(
  (
    select distance_m between 0 and 0.01
    from public.absensi
    where lahan_id = '20000000-0000-0000-0000-000000000001'
      and farmer_id = '10000000-0000-0000-0000-000000000002'
  ),
  'attendance stores its computed distance'
);
select is(
  (
    select status_geofence
    from public.absensi
    where lahan_id = '20000000-0000-0000-0000-000000000001'
      and farmer_id = '10000000-0000-0000-0000-000000000002'
  ),
  'valid'::public.geofence_status,
  'attendance status is server-validated'
);
select is(
  (
    public.register_attendance(
      '20000000-0000-0000-0000-000000000001',
      -6.200000,
      106.816666
    )
  ).id,
  (
    select id
    from public.absensi
    where lahan_id = '20000000-0000-0000-0000-000000000001'
      and farmer_id = '10000000-0000-0000-0000-000000000002'
  ),
  'same-day attendance retry returns the existing row'
);
select throws_ok(
  $$
    select public.register_attendance(
      '20000000-0000-0000-0000-000000000002',
      -6.210000,
      106.826666
    )
  $$,
  'P0001',
  'PLOT_NOT_ASSIGNED',
  'attendance rejects a plot owned by another farmer'
);
select throws_ok(
  $$
    select public.register_attendance(
      '20000000-0000-0000-0000-000000000003',
      -6.220000,
      106.836666
    )
  $$,
  'P0001',
  'PLOT_INACTIVE',
  'attendance rejects an inactive assigned plot'
);
select throws_ok(
  $$
    select public.register_attendance(
      '20000000-0000-0000-0000-000000000001',
      -6.300000,
      106.916666
    )
  $$,
  'P0001',
  'OUTSIDE_GEOFENCE',
  'attendance rejects coordinates outside the plot radius'
);
select throws_ok(
  $$
    select public.register_attendance(
      '20000000-0000-0000-0000-000000000001',
      'NaN'::numeric,
      106.816666
    )
  $$,
  'P0001',
  'COORDINATES_INVALID',
  'attendance rejects non-finite coordinates'
);

select throws_ok(
  $$
    select public.register_task_evidence(
      '70000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/attempt-1.jpg',
      'Lokasi tidak disertakan.',
      null,
      null,
      null
    )
  $$,
  'P0001',
  'EVIDENCE_LOCATION_REQUIRED',
  'location-required evidence rejects missing coordinates'
);
select throws_ok(
  $$
    select public.register_task_evidence(
      '70000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/attempt-1.jpg',
      'Lokasi terlalu jauh.',
      -6.300000,
      106.916666,
      null
    )
  $$,
  'P0001',
  'EVIDENCE_OUTSIDE_GEOFENCE',
  'location-required evidence rejects outside coordinates'
);
select throws_ok(
  $$
    select public.register_task_evidence(
      '70000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/../attempt-1.jpg',
      'Path mencoba keluar folder.',
      -6.200000,
      106.816666,
      null
    )
  $$,
  'P0001',
  'EVIDENCE_PHOTO_PATH_INVALID',
  'evidence rejects traversal and extra path segments'
);
select lives_ok(
  $$
    select public.register_task_evidence(
      '70000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/attempt-1.jpg',
      'Drainase sudah diperiksa.',
      -6.200000,
      106.816666,
      'Tidak ada sumbatan terlihat.'
    )
  $$,
  'assigned farmer can register valid evidence'
);
select is(
  (
    select farmer_id
    from public.task_evidence
    where task_id = '70000000-0000-0000-0000-000000000001'
      and attempt_number = 1
  ),
  '10000000-0000-0000-0000-000000000002'::uuid,
  'evidence derives farmer from the assigned task'
);
select is(
  (
    select lahan_id
    from public.task_evidence
    where task_id = '70000000-0000-0000-0000-000000000001'
      and attempt_number = 1
  ),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'evidence derives plot from the assigned task'
);
select is(
  (
    select attempt_number
    from public.task_evidence
    where task_id = '70000000-0000-0000-0000-000000000001'
  ),
  1,
  'first evidence registration derives attempt number one'
);
select is(
  (
    select review_status
    from public.task_evidence
    where task_id = '70000000-0000-0000-0000-000000000001'
  ),
  'pending',
  'new evidence waits for internal review'
);
select is(
  (
    select status
    from public.tasks
    where id = '70000000-0000-0000-0000-000000000001'
  ),
  'sedang_dikerjakan'::public.task_status,
  'submitting evidence keeps the task in progress'
);
select throws_ok(
  $$
    select public.register_task_evidence(
      '70000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/attempt-2.png',
      'Percobaan kedua terlalu cepat.',
      -6.200000,
      106.816666,
      null
    )
  $$,
  'P0001',
  'EVIDENCE_PENDING_REVIEW',
  'second pending evidence attempt is rejected'
);

select throws_ok(
  $$
    select public.review_task_evidence(
      (
        select id
        from public.task_evidence
        where task_id = '70000000-0000-0000-0000-000000000001'
          and attempt_number = 1
      ),
      'accepted',
      null
    )
  $$,
  'P0001',
  'INTERNAL_REQUIRED',
  'farmer cannot review task evidence'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select public.review_task_evidence(
      (
        select id
        from public.task_evidence
        where task_id = '70000000-0000-0000-0000-000000000001'
          and attempt_number = 1
      ),
      'revision_requested',
      null
    )
  $$,
  'P0001',
  'REVIEW_NOTE_REQUIRED',
  'revision review requires a note'
);
select lives_ok(
  $$
    select public.review_task_evidence(
      (
        select id
        from public.task_evidence
        where task_id = '70000000-0000-0000-0000-000000000001'
          and attempt_number = 1
      ),
      'revision_requested',
      'Foto perlu menampilkan seluruh saluran.'
    )
  $$,
  'internal can request evidence revision'
);
select is(
  (
    select review_status
    from public.task_evidence
    where task_id = '70000000-0000-0000-0000-000000000001'
      and attempt_number = 1
  ),
  'revision_requested',
  'revision persists on the reviewed evidence attempt'
);
select is(
  (
    select reviewed_by
    from public.task_evidence
    where task_id = '70000000-0000-0000-0000-000000000001'
      and attempt_number = 1
  ),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'evidence review derives the internal reviewer'
);
select is(
  (
    select status
    from public.tasks
    where id = '70000000-0000-0000-0000-000000000001'
  ),
  'sedang_dikerjakan'::public.task_status,
  'revision keeps the task in progress'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.register_task_evidence(
      '70000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/attempt-2.png',
      'Foto sudah diperbaiki.',
      -6.200000,
      106.816666,
      'Seluruh saluran terlihat.'
    )
  $$,
  'farmer can submit a new attempt after revision'
);
select is(
  (
    select max(attempt_number)
    from public.task_evidence
    where task_id = '70000000-0000-0000-0000-000000000001'
  ),
  2,
  'new evidence after revision receives the next attempt number'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.review_task_evidence(
      (
        select id
        from public.task_evidence
        where task_id = '70000000-0000-0000-0000-000000000001'
          and attempt_number = 2
      ),
      'accepted',
      null
    )
  $$,
  'internal can accept pending evidence'
);
select is(
  (
    select review_status
    from public.task_evidence
    where task_id = '70000000-0000-0000-0000-000000000001'
      and attempt_number = 2
  ),
  'accepted',
  'accepted review persists on the selected attempt'
);
select is(
  (
    select status
    from public.tasks
    where id = '70000000-0000-0000-0000-000000000001'
  ),
  'selesai'::public.task_status,
  'accepted evidence completes the assigned task'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select public.register_task_evidence(
      '70000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/attempt-2.png',
      'Task sudah selesai.',
      -6.200000,
      106.816666,
      null
    )
  $$,
  'P0001',
  'TASK_ALREADY_COMPLETED',
  'completed task rejects another evidence attempt'
);

reset role;

insert into public.lahan (
  id,
  nama_lahan,
  farmer_id,
  jenis_tanaman,
  lat_center,
  lng_center,
  radius_geofence_m,
  status
) values (
  '20000000-0000-0000-0000-000000000004',
  'Plot B Private Task 4',
  '10000000-0000-0000-0000-000000000003',
  'Kedelai',
  -6.230000,
  106.846666,
  200,
  'aktif'
);

insert into public.tasks (
  id,
  lahan_id,
  assigned_to,
  assigned_by,
  judul,
  deskripsi,
  status,
  scheduled_for,
  requires_location
) values
  (
    '80000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Task silang Farmer A',
    'Task Farmer A pada plot milik Farmer B untuk menguji akses lahan.',
    'sedang_dikerjakan',
    (now() at time zone 'Asia/Jakarta')::date,
    true
  ),
  (
    '80000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Task privat Farmer B',
    'Task yang hanya boleh terlihat oleh Farmer B dan internal.',
    'sedang_dikerjakan',
    (now() at time zone 'Asia/Jakarta')::date,
    true
  );

insert into public.absensi (
  id,
  farmer_id,
  lahan_id,
  waktu_masuk,
  lat,
  lng,
  status_geofence,
  distance_m,
  attendance_date
) values
  (
    '90000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    now(),
    -6.210000,
    106.826666,
    'valid',
    0,
    (now() at time zone 'Asia/Jakarta')::date
  ),
  (
    '90000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    now(),
    -6.230000,
    106.846666,
    'valid',
    0,
    (now() at time zone 'Asia/Jakarta')::date
  );

insert into storage.objects (bucket_id, name, owner, owner_id) values
  (
    'task-evidence',
    '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000001/referenced.jpg',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002'
  ),
  (
    'task-evidence',
    '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000001/orphan.jpg',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002'
  ),
  (
    'task-evidence',
    '10000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000002/farmer-b.jpg',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  );

insert into public.task_evidence (
  id,
  task_id,
  farmer_id,
  lahan_id,
  photo_path,
  storage_object_id,
  note,
  attempt_number,
  review_status
) values
  (
    'a0000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000001/referenced.jpg',
    (
      select object.id
      from storage.objects object
      where object.bucket_id = 'task-evidence'
        and object.name =
          '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000001/referenced.jpg'
    ),
    'Bukti Farmer A untuk pengujian RLS.',
    1,
    'revision_requested'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '80000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000002/farmer-b.jpg',
    (
      select object.id
      from storage.objects object
      where object.bucket_id = 'task-evidence'
        and object.name =
          '10000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000002/farmer-b.jpg'
    ),
    'Bukti Farmer B untuk pengujian RLS.',
    1,
    'revision_requested'
  );

insert into public.rekomendasi_cuaca (
  id,
  lahan_id,
  tanggal,
  kondisi_cuaca,
  rekomendasi_aktivitas
) values
  (
    'b0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    (now() at time zone 'Asia/Jakarta')::date,
    'Cerah',
    'Pantau irigasi.'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    (now() at time zone 'Asia/Jakarta')::date,
    'Berawan',
    'Periksa drainase.'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    (now() at time zone 'Asia/Jakarta')::date,
    'Hujan',
    'Tunda pemupukan.'
  );

select is(
  (
    select count(*)
    from pg_catalog.pg_class table_definition
    join pg_catalog.pg_namespace namespace
      on namespace.oid = table_definition.relnamespace
    where namespace.nspname = 'public'
      and table_definition.relname in (
        'users',
        'lahan',
        'absensi',
        'tasks',
        'rekomendasi_cuaca',
        'task_evidence',
        'weather_snapshots',
        'ai_generation_runs',
        'ai_generation_targets',
        'ai_task_drafts'
      )
      and table_definition.relrowsecurity
  ),
  10::bigint,
  'RLS is enabled on every public operational table'
);
select has_function(
  'public',
  'can_access_plot',
  array['uuid'],
  'plot access helper exists'
);
with helper(signature) as (
  values
    ('public.can_access_plot(uuid)')
)
select ok(
  count(*) = 1
    and bool_and(function_definition.prosecdef)
    and bool_and(
      function_definition.proconfig = array['search_path=""']::text[]
    ),
  'RLS helpers are SECURITY DEFINER with an empty search path'
)
from helper
join pg_catalog.pg_proc function_definition
  on function_definition.oid = pg_catalog.to_regprocedure(helper.signature);
select ok(
  (
    select function_definition.prosecdef
      and function_definition.proconfig = array['search_path=""']::text[]
    from pg_catalog.pg_proc function_definition
    where function_definition.oid =
      pg_catalog.to_regprocedure(
        'public.sign_up_user(text,text,text,public.user_role)'
      )
  ),
  'public signup is hardened as SECURITY DEFINER with empty search path'
);
select ok(
  has_function_privilege(
    'anon',
    pg_catalog.to_regprocedure(
      'public.sign_up_user(text,text,text,public.user_role)'
    ),
    'EXECUTE'
  ),
  'anonymous users can execute farmer signup'
);
select ok(
  not has_function_privilege(
    'authenticated',
    pg_catalog.to_regprocedure(
      'public.sign_up_user(text,text,text,public.user_role)'
    ),
    'EXECUTE'
  ),
  'authenticated users cannot execute public signup'
);
select ok(
  not has_function_privilege(
    'service_role',
    pg_catalog.to_regprocedure(
      'public.sign_up_user(text,text,text,public.user_role)'
    ),
    'EXECUTE'
  ),
  'service role uses the administrative provisioning path instead of signup'
);
select ok(
  has_table_privilege('authenticated', 'public.users', 'SELECT')
    and not has_table_privilege('authenticated', 'public.users', 'INSERT')
    and not has_table_privilege('authenticated', 'public.users', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.users', 'DELETE'),
  'authenticated users can only select scoped user rows'
);
select ok(
  has_table_privilege('authenticated', 'public.tasks', 'SELECT')
    and has_table_privilege('authenticated', 'public.tasks', 'INSERT')
    and not has_table_privilege('authenticated', 'public.tasks', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.tasks', 'DELETE'),
  'authenticated task writes are limited to constrained manual inserts'
);
select ok(
  has_table_privilege('authenticated', 'public.absensi', 'SELECT')
    and not has_table_privilege('authenticated', 'public.absensi', 'INSERT')
    and not has_table_privilege('authenticated', 'public.absensi', 'UPDATE')
    and has_table_privilege('authenticated', 'public.task_evidence', 'SELECT')
    and not has_table_privilege(
      'authenticated',
      'public.task_evidence',
      'INSERT'
    )
    and not has_table_privilege(
      'authenticated',
      'public.task_evidence',
      'UPDATE'
    ),
  'attendance and evidence writes are RPC-only'
);
select ok(
  has_table_privilege('service_role', 'public.weather_snapshots', 'INSERT')
    and has_table_privilege(
      'service_role',
      'public.ai_generation_runs',
      'UPDATE'
    )
    and has_table_privilege(
      'service_role',
      'public.ai_generation_targets',
      'INSERT'
    )
    and has_table_privilege(
      'service_role',
      'public.ai_task_drafts',
      'INSERT'
    ),
  'service role retains direct Edge Function operations'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)
    from public.users
    where id in (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003'
    )
  ),
  3::bigint,
  'internal can read every operational fixture user'
);
select is(
  (
    select count(*)
    from public.lahan
    where id = '20000000-0000-0000-0000-000000000004'
  ),
  1::bigint,
  'internal can read every plot'
);
select ok(
  (select count(*) from public.ai_generation_runs) > 0,
  'internal can read AI generation operations'
);
select ok(
  (select count(*) from public.weather_snapshots) > 0,
  'internal can read raw weather snapshots'
);
select lives_ok(
  $$
    insert into public.tasks (
      id,
      lahan_id,
      assigned_to,
      assigned_by,
      judul,
      deskripsi,
      status,
      scheduled_for,
      source,
      source_draft_id,
      requires_location
    ) values (
      '81000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'Task manual internal',
      'Task manual valid yang dibuat melalui kebijakan internal.',
      'belum_dikerjakan',
      (now() at time zone 'Asia/Jakarta')::date,
      'manual',
      null,
      false
    )
  $$,
  'internal can insert a constrained manual task'
);
select throws_ok(
  $$
    insert into public.tasks (
      lahan_id,
      assigned_to,
      assigned_by,
      judul,
      deskripsi,
      status,
      scheduled_for,
      source,
      source_draft_id
    ) values (
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003',
      'Task forged assigner',
      'Task ini harus ditolak karena assigned_by telah dipalsukan.',
      'belum_dikerjakan',
      (now() at time zone 'Asia/Jakarta')::date,
      'manual',
      null
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "tasks"',
  'internal cannot forge the manual task assigner'
);
select throws_ok(
  $$
    update public.tasks
    set status = 'selesai'
    where id = '81000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  'permission denied for table tasks',
  'internal cannot bypass evidence review with direct task updates'
);
select throws_ok(
  $$
    update public.users
    set role = 'internal'
    where id = '10000000-0000-0000-0000-000000000002'
  $$,
  '42501',
  'permission denied for table users',
  'internal cannot rewrite roles through the client table'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select array_agg(id order by id) from public.users),
  array['10000000-0000-0000-0000-000000000002'::uuid],
  'farmer reads only their own user row'
);
select is(
  (select array_agg(id order by id) from public.lahan),
  array[
    '20000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid,
    '20000000-0000-0000-0000-000000000003'::uuid
  ],
  'farmer reads owned plots and plots referenced by assigned tasks'
);
select ok(
  exists (
    select 1
    from public.tasks
    where id = '80000000-0000-0000-0000-000000000001'
      and assigned_to = auth.uid()
  )
    and not exists (
    select 1 from public.tasks where assigned_to <> auth.uid()
  ),
  'farmer reads own assigned task and no foreign task'
);
select ok(
  exists (
    select 1
    from public.absensi
    where id = '90000000-0000-0000-0000-000000000001'
      and farmer_id = auth.uid()
  )
    and not exists (
    select 1 from public.absensi where farmer_id <> auth.uid()
  ),
  'farmer reads own attendance and no foreign attendance'
);
select ok(
  exists (
    select 1
    from public.task_evidence
    where id = 'a0000000-0000-0000-0000-000000000001'
      and farmer_id = auth.uid()
  )
    and not exists (
    select 1 from public.task_evidence where farmer_id <> auth.uid()
  ),
  'farmer reads own evidence and no foreign evidence'
);
select is(
  (select array_agg(lahan_id order by lahan_id) from public.weather_snapshots),
  array['20000000-0000-0000-0000-000000000001'::uuid],
  'farmer reads weather snapshots only for assigned plots'
);
select is(
  (
    select
      (select count(*) from public.ai_generation_runs)
      + (select count(*) from public.ai_generation_targets)
      + (select count(*) from public.ai_task_drafts)
  ),
  0::bigint,
  'farmer cannot read AI operations'
);
select is(
  (select array_agg(lahan_id order by lahan_id) from public.rekomendasi_cuaca),
  array[
    '20000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid
  ],
  'farmer reads recommendations only for accessible plots'
);
select throws_ok(
  $$
    insert into public.task_evidence (
      task_id,
      farmer_id,
      lahan_id,
      photo_path,
      attempt_number,
      review_status
    ) values (
      '80000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002',
      'forged.jpg',
      2,
      'accepted'
    )
  $$,
  '42501',
  'permission denied for table task_evidence',
  'farmer cannot forge evidence or review fields directly'
);
select throws_ok(
  $$
    insert into public.absensi (
      farmer_id,
      lahan_id,
      lat,
      lng,
      status_geofence,
      attendance_date
    ) values (
      '10000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      -6.2,
      106.8,
      'valid',
      (now() at time zone 'Asia/Jakarta')::date
    )
  $$,
  '42501',
  'permission denied for table absensi',
  'farmer cannot bypass attendance validation'
);
select throws_ok(
  $$
    update public.tasks
    set status = 'selesai'
    where id = '80000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  'permission denied for table tasks',
  'farmer cannot complete an assigned task directly'
);
select throws_ok(
  $$
    update public.users
    set role = 'internal'
    where id = auth.uid()
  $$,
  '42501',
  'permission denied for table users',
  'farmer cannot elevate their own role'
);
select ok(
  exists (
    select 1
    from storage.objects
    where bucket_id = 'task-evidence'
      and name like auth.uid()::text || '/%'
  )
    and not exists (
      select 1
      from storage.objects
      where bucket_id = 'task-evidence'
        and name like
          '10000000-0000-0000-0000-000000000003/%'
    ),
  'farmer reads only their storage folder'
);
select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values (
      'task-evidence',
      '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000001/upload-valid.jpg',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  'farmer can upload to an assigned non-completed task path'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values (
      'task-evidence',
      '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000001/extra/invalid.jpg',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'storage upload rejects malformed extra path segments'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values (
      'task-evidence',
      '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000002/cross-task.jpg',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'storage upload rejects another farmer task'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values (
      'task-evidence',
      '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/completed.jpg',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'storage upload rejects completed tasks'
);
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects
where bucket_id = 'task-evidence'
  and name =
    '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000001/orphan.jpg';
select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'task-evidence'
      and name =
        '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000001/orphan.jpg'
  ),
  0::bigint,
  'farmer can clean up an unregistered own-path object'
);
select throws_ok(
  $$
    delete from storage.objects
    where bucket_id = 'task-evidence'
      and name =
        '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000001/referenced.jpg'
  $$,
  '23503',
  'update or delete on table "objects" violates foreign key constraint "task_evidence_storage_object_fkey" on table "task_evidence"',
  'foreign key prevents deleting an object referenced by immutable evidence'
);
delete from storage.objects
where bucket_id = 'task-evidence'
  and name =
    '10000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000002/farmer-b.jpg';

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select ok(
  exists (
    select 1
    from public.tasks
    where id = '80000000-0000-0000-0000-000000000002'
  )
    and not exists (
      select 1
      from public.tasks
      where id = '80000000-0000-0000-0000-000000000001'
    ),
  'farmer B sees own task but not Farmer A task'
);
select ok(
  exists (
    select 1
    from public.absensi
    where id = '90000000-0000-0000-0000-000000000002'
      and farmer_id = auth.uid()
  )
    and not exists (
      select 1
      from public.absensi
    where id = '90000000-0000-0000-0000-000000000001'
  ),
  'farmer B reads own attendance but not Farmer A attendance'
);
select ok(
  exists (
    select 1
    from public.task_evidence
    where id = 'a0000000-0000-0000-0000-000000000002'
      and farmer_id = auth.uid()
  )
    and not exists (
      select 1
    from public.task_evidence
    where id = 'a0000000-0000-0000-0000-000000000001'
  ),
  'farmer B reads own evidence but not Farmer A evidence'
);
select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'task-evidence'
      and name =
        '10000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000002/farmer-b.jpg'
  ),
  1::bigint,
  'Farmer A cannot delete Farmer B storage object'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select
      (select count(*) from public.users)
      + (select count(*) from public.lahan)
      + (select count(*) from public.tasks)
  ),
  0::bigint,
  'subject-less authenticated requests cannot read operations'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;

select throws_ok(
  $$ select count(*) from public.users $$,
  '42501',
  'permission denied for table users',
  'anonymous users cannot read operational users'
);
select throws_ok(
  $$
    select public.sign_up_user(
      'forbidden-internal@example.test',
      'password-aman',
      'Forbidden Internal',
      'internal'::public.user_role
    )
  $$,
  'P0001',
  'SIGNUP_ROLE_FORBIDDEN',
  'public signup cannot create an internal account'
);
select throws_ok(
  $$
    select public.sign_up_user(
      'null-role@example.test',
      'password-aman',
      'Null Role',
      null::public.user_role
    )
  $$,
  'P0001',
  'SIGNUP_ROLE_FORBIDDEN',
  'public signup rejects a NULL role'
);
select throws_ok(
  $$
    select public.sign_up_user(
      'short-password@example.test',
      'short',
      'Short Password',
      'farmer'::public.user_role
    )
  $$,
  'P0001',
  'SIGNUP_PASSWORD_INVALID',
  'public signup enforces bounded passwords'
);
select lives_ok(
  $$
    select public.sign_up_user(
      'task4-farmer-signup@example.test',
      'password-aman',
      'Farmer Signup Task 4',
      'farmer'::public.user_role
    )
  $$,
  'public signup can create a bounded farmer account'
);

reset role;
select ok(
  exists (
    select 1
    from public.users app_user
    join auth.identities identity
      on identity.user_id = app_user.id
    where app_user.email = 'task4-farmer-signup@example.test'
      and app_user.role = 'farmer'::public.user_role
      and identity.provider = 'email'
  ),
  'farmer signup creates matching auth identity and farmer profile'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'task-evidence'
      and name =
        '10000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000002/farmer-b.jpg'
  ),
  1::bigint,
  'internal can read every evidence storage object'
);

reset role;

create temporary table task8_cron_guard_baseline
on commit drop
as
select
  target.id,
  target.version,
  target.run_id,
  (
    select count(*)
    from public.ai_task_drafts draft
    where draft.generation_target_id = target.id
  ) as draft_count,
  (
    select count(*)
    from public.ai_task_drafts draft
    where draft.generation_target_id = target.id
      and draft.status = 'pending'
  ) as pending_draft_count
from public.ai_generation_targets target
where target.lahan_id = '20000000-0000-0000-0000-000000000001'
  and target.scheduled_for =
    (pg_catalog.now() at time zone 'Asia/Jakarta')::date
  and target.is_current
  and target.status = 'succeeded';

select is(
  (select count(*) from task8_cron_guard_baseline),
  1::bigint,
  'cron race fixture starts with one succeeded current target'
);

insert into public.ai_generation_runs (
  id,
  trigger,
  scheduled_for,
  requested_by,
  status,
  model,
  plot_count
) values
  (
    '41000000-0000-0000-0000-000000000001',
    'cron',
    (pg_catalog.now() at time zone 'Asia/Jakarta')::date,
    null,
    'running',
    'test/model',
    1
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    'cron',
    (pg_catalog.now() at time zone 'Asia/Jakarta')::date,
    null,
    'running',
    'test/model',
    1
  );

create temporary table task8_cron_replace_result (
  target_id uuid not null
) on commit drop;

grant insert on task8_cron_replace_result to service_role;

set local role service_role;

insert into task8_cron_replace_result (target_id)
select public.replace_ai_task_drafts(
  '41000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  (pg_catalog.now() at time zone 'Asia/Jakarta')::date,
  '30000000-0000-0000-0000-000000000001',
  'test/model',
  'Cron kedua tidak boleh mengganti target yang sudah sukses.',
  '[
    {
      "judul":"Draft dari cron terlambat",
      "deskripsi":"Draft ini tidak boleh tersimpan karena cron pertama sudah sukses.",
      "priority":"medium",
      "requires_location":true,
      "ai_reason":"Menguji guard atomik cron pada jalur sukses."
    }
  ]'::jsonb
);

reset role;

select is(
  (select target_id from task8_cron_replace_result),
  (select id from task8_cron_guard_baseline),
  'later cron replacement returns the first succeeded target'
);
select is(
  (
    select count(*)
    from public.ai_generation_targets
    where run_id = '41000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'later cron replacement inserts no target row'
);
select is(
  (
    select id
    from public.ai_generation_targets
    where lahan_id = '20000000-0000-0000-0000-000000000001'
      and scheduled_for =
        (pg_catalog.now() at time zone 'Asia/Jakarta')::date
      and is_current
  ),
  (select id from task8_cron_guard_baseline),
  'later cron replacement preserves the succeeded current target'
);
select is(
  (
    select max(version)
    from public.ai_generation_targets
    where lahan_id = '20000000-0000-0000-0000-000000000001'
      and scheduled_for =
        (pg_catalog.now() at time zone 'Asia/Jakarta')::date
  ),
  (select version from task8_cron_guard_baseline),
  'later cron replacement preserves the target version'
);
select is(
  (
    select count(*)
    from public.ai_task_drafts draft
    where draft.generation_target_id =
      (select id from task8_cron_guard_baseline)
      and draft.status = 'pending'
  ),
  (select pending_draft_count from task8_cron_guard_baseline),
  'later cron replacement preserves pending drafts'
);

create temporary table task8_cron_record_result (
  target_id uuid not null
) on commit drop;

grant insert on task8_cron_record_result to service_role;

set local role service_role;

insert into task8_cron_record_result (target_id)
select public.record_ai_generation_target(
  '41000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  (pg_catalog.now() at time zone 'Asia/Jakarta')::date,
  'failed',
  'weather_unavailable',
  null,
  null
);

reset role;

select is(
  (select target_id from task8_cron_record_result),
  (select id from task8_cron_guard_baseline),
  'later cron failure returns the first succeeded target'
);
select is(
  (
    select count(*)
    from public.ai_generation_targets
    where run_id = '41000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'later cron failure inserts no target row'
);
select is(
  (
    select pg_catalog.jsonb_build_object(
      'current_id',
      target.id,
      'version',
      target.version,
      'draft_count',
      (
        select count(*)
        from public.ai_task_drafts draft
        where draft.generation_target_id = target.id
      ),
      'pending_draft_count',
      (
        select count(*)
        from public.ai_task_drafts draft
        where draft.generation_target_id = target.id
          and draft.status = 'pending'
      )
    )
    from public.ai_generation_targets target
    where target.lahan_id = '20000000-0000-0000-0000-000000000001'
      and target.scheduled_for =
        (pg_catalog.now() at time zone 'Asia/Jakarta')::date
      and target.is_current
  ),
  (
    select pg_catalog.jsonb_build_object(
      'current_id',
      id,
      'version',
      version,
      'draft_count',
      draft_count,
      'pending_draft_count',
      pending_draft_count
    )
    from task8_cron_guard_baseline
  ),
  'later cron failure preserves current target, version, and drafts'
);

select * from finish();
rollback;
