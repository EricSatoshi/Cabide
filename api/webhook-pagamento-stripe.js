// api/webhook-pagamento.js — VERSÃO STRIPE (para teste rápido, sem esperar o Mercado Pago)
//
// O Stripe exige o corpo "cru" (sem parsing automático) para verificar a
// assinatura da notificação — por isso o config abaixo desliga o bodyParser
// padrão do Vercel só nesta função.
//
// Variáveis de ambiente necessárias:
//   STRIPE_SECRET_KEY          -> mesma chave da outra função
//   STRIPE_WEBHOOK_SECRET      -> gerado ao cadastrar o endpoint no painel do Stripe
//   SUPABASE_URL                -> URL do projeto Supabase
//   SUPABASE_SERVICE_ROLE_KEY   -> chave service_role (secreta, só aqui)

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: { bodyParser: false }, // precisamos do corpo cru para validar a assinatura
};

function lerCorpoCru(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).end();
  }

  const corpoCru = await lerCorpoCru(req);
  const assinatura = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(corpoCru, assinatura, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Assinatura do webhook inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      if (session.payment_status === 'paid') {
        const { dressId, startDate, endDate, customerName, customerPhone } = session.metadata || {};

        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error: insertError } = await supabase.from('bookings').insert({
          dress_id: dressId,
          start_date: startDate,
          end_date: endDate,
          customer_name: customerName,
          customer_phone: customerPhone,
          payment_id: session.id,
          status: 'confirmada',
        });

        if (insertError) {
          // Agora esse erro aparece de verdade nos Logs do Vercel, mesmo
          // a função respondendo 200 pro Stripe (o que sempre fazemos,
          // pra evitar reenvios infinitos).
          console.error('Erro ao inserir reserva no Supabase:', insertError);
        }
      }
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Erro ao processar webhook:', err);
    return res.status(200).json({ received: true }); // evita reenvio infinito do Stripe
  }
}
