// api/crear-preferencia.js
// En Vercel, todo lo que está adentro de la carpeta "api" se convierte
// automáticamente en un endpoint. Este reemplaza al server.js de Render.

const { MercadoPagoConfig, Preference } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    // Si no configurás SITE_URL, usa automáticamente el dominio actual
    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: Number(item.price),
          currency_id: 'ARS',
        })),
        back_urls: {
          success: `${siteUrl}/exito.html`,
          failure: `${siteUrl}/error.html`,
          pending: `${siteUrl}/pendiente.html`,
        },
        auto_return: 'approved',
      },
    });

    res.status(200).json({ init_point: result.init_point });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo generar el pago' });
  }
};
