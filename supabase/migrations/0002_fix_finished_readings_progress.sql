-- 0002_fix_finished_readings_progress.sql
-- 기존 완독(finished) 상태인 회차 중 current_value가 target_value(또는 100%)에 미달하는 레코드 일괄 보정

update readings
set current_value = coalesce(target_value, case when progress_unit = 'percent' then 100 else current_value end)
where status = 'finished'
  and (
    (target_value is not null and current_value < target_value)
    or (progress_unit = 'percent' and current_value < 100)
  );
