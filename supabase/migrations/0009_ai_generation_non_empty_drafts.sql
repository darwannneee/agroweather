alter table public.ai_generation_targets
drop constraint if exists ai_generation_targets_request_payload_check;

alter table public.ai_generation_targets
add constraint ai_generation_targets_request_payload_check
check (
  (
    status = 'succeeded'
    and request_payload is not null
    and pg_catalog.jsonb_typeof(request_payload) = 'object'
    and request_payload ?& array['model', 'result_summary', 'drafts']
    and request_payload - array['model', 'result_summary', 'drafts']
      = '{}'::jsonb
    and pg_catalog.jsonb_typeof(request_payload -> 'model') = 'string'
    and pg_catalog.char_length(request_payload ->> 'model')
      between 1 and 200
    and request_payload ->> 'model' =
      pg_catalog.btrim(request_payload ->> 'model')
    and (
      request_payload -> 'result_summary' = 'null'::jsonb
      or (
        pg_catalog.jsonb_typeof(request_payload -> 'result_summary') =
          'string'
        and pg_catalog.char_length(
          request_payload ->> 'result_summary'
        ) between 1 and 2000
        and request_payload ->> 'result_summary' =
          pg_catalog.btrim(request_payload ->> 'result_summary')
      )
    )
    and pg_catalog.jsonb_typeof(request_payload -> 'drafts') = 'array'
    and pg_catalog.jsonb_array_length(request_payload -> 'drafts')
      between 1 and 5
  )
  or (
    status <> 'succeeded'
    and request_payload is null
  )
) not valid;

alter table public.ai_generation_targets
drop constraint if exists ai_generation_targets_succeeded_draft_count_check;

alter table public.ai_generation_targets
add constraint ai_generation_targets_succeeded_draft_count_check
check (
  (
    status = 'succeeded'
    and draft_count between 1 and 5
  )
  or (
    status <> 'succeeded'
    and draft_count between 0 and 5
  )
) not valid;

create or replace function
  public.enforce_non_empty_succeeded_ai_generation_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'succeeded' then
    if new.draft_count < 1 or new.draft_count > 5 then
      raise exception 'AI_DRAFT_LIMIT';
    end if;

    if new.request_payload is null
      or pg_catalog.jsonb_typeof(new.request_payload) <> 'object'
      or not (new.request_payload ? 'drafts')
      or pg_catalog.jsonb_typeof(new.request_payload -> 'drafts') <> 'array'
      or coalesce(
        pg_catalog.jsonb_array_length(new.request_payload -> 'drafts'),
        0
      ) < 1
      or coalesce(
        pg_catalog.jsonb_array_length(new.request_payload -> 'drafts'),
        0
      ) > 5
    then
      raise exception 'AI_DRAFT_LIMIT';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ai_generation_targets_non_empty_succeeded
on public.ai_generation_targets;

create trigger ai_generation_targets_non_empty_succeeded
before insert or update of status, draft_count, request_payload
on public.ai_generation_targets
for each row
execute function public.enforce_non_empty_succeeded_ai_generation_target();
