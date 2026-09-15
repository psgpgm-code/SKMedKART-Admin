-- SKMedKART: public catalogue mirror only
-- Billing / Purchase / Stock / Customers / Reminders stay local in Admin.
-- Customer orders are WhatsApp only and do not reserve stock.

CREATE OR REPLACE FUNCTION public.replace_public_catalog(catalog jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supplied_key text;
BEGIN
  supplied_key := current_setting('request.headers', true)::json->>'x-skm-catalog-key';

  IF supplied_key IS DISTINCT FROM 'kzYrQ9lW21uAb5gbKs6wHSnGpiDGncS1HF_gRn4ukBQ' THEN
    RAISE EXCEPTION 'catalog publisher not authorized';
  END IF;

  DELETE FROM public.public_catalog;

  INSERT INTO public.public_catalog
    (id,name,category,price,mrp,stock,active,updated_at)
  SELECT id,name,category,price,mrp,stock,active,updated_at
  FROM jsonb_to_recordset(COALESCE(catalog,'[]'::jsonb)) AS x(
    id text,
    name text,
    category text,
    price numeric,
    mrp numeric,
    stock numeric,
    active boolean,
    updated_at timestamptz
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_public_catalog(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_public_catalog(jsonb) TO anon;
GRANT SELECT ON public.public_catalog TO anon;
