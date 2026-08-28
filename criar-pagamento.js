// api/criar-pagamento.js — VERSÃO STRIPE
//
// Variáveis de ambiente necessárias:
//   STRIPE_SECRET_KEY  -> chave "Secret key" de teste do Stripe (começa com sk_test_)
//   SITE_URL           -> URL pública do site, ex: https://cabide-five.vercel.app

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { dressId, dressName, price, startDate, endDate, customerName, customerPhone } = req.body || {};

  if (!dressId || !dressName || !price || !startDate || !endDate || !customerName || !customerPhone) {
    return res.status(400).json({ error: 'Dados incompletos para criar a reserva' });
  }

  const nights = Math.max(
    1,
    Math.round((new Date(endDate) - new Date(startDate)) / 86400000)
  );
  const total = Number(price) * nights;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: { name: `Aluguel: ${dressName} (${startDate} a ${endDate})` },
            unit_amount: Math.round(total * 100), // Stripe trabalha em centavos
          },
          quantity: 1,
        },
      ],
      metadata: { dressId, startDate, endDate, customerName, customerPhone },
      success_url: `${process.env.SITE_URL}/sucesso.html`,
      cancel_url: `${process.env.SITE_URL}/erro.html`,
    });

    return res.status(200).json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('Erro do Stripe:', err);
    return res.status(500).json({ error: 'Não foi possível criar o pagamento' });
  }
}
