// api/webhook-pagamento.js
//
// Função serverless "de fundo" — não é chamada pelo site, é chamada
// diretamente pelo Mercado Pago quando o status de um pagamento muda.
// Ela confirma o pagamento e grava a reserva no Supabase usando a chave
// "service_role" (que tem permissão de escrita e NUNCA deve aparecer
// no HTML/JS que vai para o navegador — só existe aqui, como variável
// de ambiente do servidor).
//
// Variáveis de ambiente necessárias:
//   MP_ACCESS_TOKEN            -> mesmo Access Token da outra função
//   SUPABASE_URL                -> URL do projeto Supabase
//   SUPABASE_SERVICE_ROLE_KEY   -> chave "service_role" (em Project Settings > API)

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // O Mercado Pago também testa a URL com GET — só processamos POST de verdade
  if (req.method !== 'POST') {
    return res.status(200).end();
  }

  try {
    const { type, data } = req.body || {};

    // Só nos interessam notificações de pagamento
    if (type !== 'payment' || !data?.id) {
      return res.status(200).end();
    }

    // Busca os detalhes reais do pagamento na API do Mercado Pago —
    // nunca confiamos apenas no que chega na notificação, sempre confirmamos.
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const payment = await mpResp.json();

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (payment.status === 'approved') {
      const { dressId, startDate, endDate, customerName, customerPhone } = payment.metadata || {};

      await supabase.from('bookings').insert({
        dress_id: dressId,
        start_date: startDate,
        end_date: endDate,
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_id: String(data.id),
        status: 'confirmada',
      });
    }
    // Pagamentos recusados/pendentes não geram reserva — o cliente pode tentar de novo.

    return res.status(200).end();
  } catch (err) {
    console.error('Erro no webhook de pagamento:', err);
    // Devolvemos 200 mesmo em erro interno para o Mercado Pago não ficar
    // reenviando a notificação indefinidamente; o erro fica logado pra você investigar.
    return res.status(200).end();
  }
}
