-- Precios y cuotas fijados a partir del costo medido (npm run medir:costo)
-- y del modelo de viabilidad (npm run viabilidad).
--
-- Costo real: $0.0108/min ($0.65/hora), del cual Deepgram es el 71%.
-- Estos importes dejan 74% de margen en Profesional y 65% en Intensivo
-- suponiendo que el cliente agote su cuota, que es el peor caso.

-- La prueba baja de 30 a 5 minutos: suficiente para ver la calidad en una
-- consulta corta, y barato de regalar ($0.05 por cuenta) frente al riesgo de
-- que se use como plan gratuito permanente.
update public.plans
   set name = 'Prueba',
       monthly_minutes = 5
 where id = 'free';

update public.plans
   set name = 'Profesional',
       monthly_minutes = 900,
       price_cents = 3900
 where id = 'pro';

update public.plans
   set name = 'Intensivo',
       monthly_minutes = 4000,
       price_cents = 12900
 where id = 'scale';

-- El importe cambió, así que los precios anteriores de Stripe ya no valen:
-- se limpian para que `npm run stripe:setup` cree los nuevos y no se cobre
-- por error el importe viejo.
update public.plans
   set stripe_price_id = null
 where price_cents > 0;
