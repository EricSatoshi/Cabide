// api/criar-pagamento.js
//
// Função serverless (roda no servidor do Vercel/Netlify, nunca no navegador).
// Recebe os dados da reserva escolhida pelo cliente e cria uma cobrança no
// Mercado Pago, devolvendo o link de checkout para o navegador redirecionar.
//
// Variáveis de ambiente necessárias (configure no painel do Vercel/Netlify,
// NUNCA escreva esses valores direto no código):
//   MP_ACCESS_TOKEN   -> Access Token de produção da sua conta Mercado Pago
//   SITE_URL          -> URL pública do site, ex: https://cabide.com.br

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { dressId, dressName, price, startDate, endDate, customerName, customerPhone } = req.body || {};

  // Validação básica dos dados recebidos do site
  if (!dressId || !dressName || !price || !startDate || !endDate || !customerName || !customerPhone) {
    return res.status(400).json({ error: 'Dados incompletos para criar a reserva' });
  }

  const nights = Math.max(
    1,
    Math.round((new Date(endDate) - new Date(startDate)) / 86400000)
  );
  const total = Number(price) * nights;

  const preference = {
    items: [
      {
        title: `Aluguel: ${dressName} (${startDate} a ${endDate})`,
        quantity: 1,
        unit_price: total,
        currency_id: 'BRL',
      },
    ],
    payer: { name: customerName },
    // metadata volta junto quando o Mercado Pago avisa o webhook —
    // é assim que sabemos qual reserva confirmar depois do pagamento
    metadata: { dressId, startDate, endDate, customerName, customerPhone },
    back_urls: {
      success: `${process.env.SITE_URL}/sucesso.html`,
      failure: `${process.env.SITE_URL}/erro.html`,
      pending: `${process.env.SITE_URL}/pendente.html`,
    },
    auto_return: 'approved',
    notification_url: `${process.env.SITE_URL}/api/webhook-pagamento`,
  };

  try {
    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Erro do Mercado Pago:', data);
      return res.status(500).json({ error: 'Não foi possível criar o pagamento' });
    }

    return res.status(200).json({ checkoutUrl: data.init_point });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro inesperado ao criar o pagamento' });
  }
}
