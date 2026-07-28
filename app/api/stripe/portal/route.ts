import { NextResponse } from "next/server";
import { getStripe } from "@/app/lib/stripe";
import { createClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Portal de cliente de Stripe: cambiar de plan, método de pago o cancelar. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single<{ stripe_customer_id: string | null }>();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Todavía no tienes suscripción." },
      { status: 400 }
    );
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${new URL(req.url).origin}/cuenta`,
  });

  return NextResponse.json({ url: session.url });
}
