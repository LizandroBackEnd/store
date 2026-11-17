import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return new Response(JSON.stringify(products), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return new Response(
      JSON.stringify({ error: 'Error al obtener los productos' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return new Response(
        JSON.stringify({ error: 'Cuerpo de solicitud inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { name, price, stock, categoryId } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(
        JSON.stringify({ error: 'El nombre del producto es obligatorio' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return new Response(
        JSON.stringify({ error: 'El precio debe ser un número mayor o igual a 0' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const numStock = stock !== undefined ? parseInt(String(stock), 10) : 0;
    if (isNaN(numStock) || numStock < 0) {
      return new Response(
        JSON.stringify({ error: 'El stock inicial debe ser un entero mayor o igual a 0' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!categoryId || typeof categoryId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'La categoría es obligatoria' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify category exists
    const categoryExists = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!categoryExists) {
      return new Response(
        JSON.stringify({ error: 'La categoría seleccionada no existe' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create product and initial movement if stock > 0
    const newProduct = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: name.trim(),
          price: numPrice,
          stock: numStock,
          categoryId,
        },
        include: {
          category: true,
          movements: true,
        },
      });

      if (numStock > 0) {
        await tx.stockMovement.create({
          data: {
            type: 'IN',
            quantity: numStock,
            note: 'Inventario inicial',
            productId: created.id,
          },
        });
      }

      return created;
    });

    return new Response(JSON.stringify(newProduct), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return new Response(
      JSON.stringify({ error: 'Error al crear el producto' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
