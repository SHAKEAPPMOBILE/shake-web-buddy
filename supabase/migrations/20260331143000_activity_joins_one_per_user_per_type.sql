DELETE FROM public.activity_joins aj
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, activity_type
      ORDER BY joined_at ASC, id ASC
    ) AS row_num
  FROM public.activity_joins
) ranked
WHERE aj.id = ranked.id
  AND ranked.row_num > 1;

ALTER TABLE public.activity_joins
DROP CONSTRAINT IF EXISTS one_activity_per_user_per_type;

ALTER TABLE public.activity_joins
ADD CONSTRAINT one_activity_per_user_per_type
UNIQUE (user_id, activity_type);
