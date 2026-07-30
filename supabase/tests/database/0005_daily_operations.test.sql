begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

select has_table('public', 'weather_snapshots', 'weather snapshots exist');
select has_table('public', 'ai_generation_runs', 'generation runs exist');
select has_table('public', 'ai_generation_targets', 'generation targets exist');
select has_table('public', 'ai_task_drafts', 'AI drafts exist');

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
select has_column('public', 'absensi', 'attendance_date', 'attendance has Jakarta date');

select col_not_null('public', 'tasks', 'scheduled_for', 'task date is required');
select col_not_null('public', 'task_evidence', 'attempt_number', 'attempt is required');
select col_not_null('public', 'task_evidence', 'review_status', 'review status is required');
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

select * from finish();
rollback;
