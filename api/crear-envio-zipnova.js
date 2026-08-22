// api/crear-envio-zipnova.js
// Se llama automáticamente después de un pago aprobado, con los datos
// del comprador (dirección) y del pedido (productos físicos).
//
// Zipnova es más simple que otros correos: no hace falta pedir un token
// aparte. La API Key y el API Token que generaste funcionan directo como
// usuario/contraseña (Autenticación Básica HTTP) en cada llamado.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { comprador, pedidoId, valorDeclarado, bultoDescripcion, pesoGramos } = req.body;

    if (!comprador || !comprador.calle || !comprador.numero || !comprador.localidad || !comprador.provincia) {
      return res.status(400).json({ error: 'Faltan datos de dirección del comprador' });
    }

    const apiToken = process.env.ZIPNOVA_API_TOKEN;
    const apiSecret = process.env.ZIPNOVA_API_SECRET;
    const accountId = process.env.ZIPNOVA_ACCOUNT_ID;
    const originId = process.env.ZIPNOVA_ORIGIN_ID;

    if (!apiToken || !apiSecret || !accountId || !originId) {
      throw new Error('Faltan variables de entorno de Zipnova (API Token, API Secret, Account ID u Origin ID)');
    }

    // Autenticación básica: usuario = API Token, contraseña = API Secret
    const basicAuth = Buffer.from(`${apiToken}:${apiSecret}`).toString('base64');

    const baseUrl = 'https://api.zipnova.com.ar/v2';

    const body = {
      account_id: Number(accountId),
      external_id: pedidoId || `pedido-${Date.now()}`,
      // No indicamos service_type/carrier_id: Zipnova cotiza y elige
      // automáticamente el transportista más conveniente.
      origin_id: originId,
      declared_value: valorDeclarado || 0,
      source: "tienda-web",
      destination: {
        name: comprador.nombre,
        document: comprador.dni || "00000000",
        email: comprador.email,
        phone: comprador.telefono || "",
        street: comprador.calle,
        street_number: comprador.numero,
        street_extras: [comprador.piso, comprador.depto].filter(Boolean).join(' '),
        city: comprador.localidad,
        state: comprador.provincia,
        zipcode: comprador.codigoPostal || "",
      },
      // Un solo paquete genérico con el conjunto de productos 3D del pedido.
      // Los números de peso/tamaño son un valor por defecto conservador;
      // ajustalos según lo que sueles despachar.
      packages: [
        {
          weight: pesoGramos || 500,
          height: 15,
          width: 15,
          length: 15,
          description_1: (bultoDescripcion || "Productos varios").slice(0, 50),
        },
      ],
    };

    const result = await fetch(`${baseUrl}/shipments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify(body),
    });

    const data = await result.json();

    if (!result.ok) {
      console.error('Error de Zipnova:', data);
      return res.status(result.status).json({ error: 'Zipnova rechazó el envío', detalle: data });
    }

    res.status(200).json({
      ok: true,
      shipmentId: data.id,
      tracking: data.tracking || null,
      transportista: data.carrier?.name || null,
      costoEnvio: data.price_incl_tax || null,
      detalle: data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'No se pudo crear el envío' });
  }
};
