import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(50, Math.max(1, parseInt(limitParam, 10))) : 10;

    const movements = await prisma.stockMovement.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    });

    return new Response(JSON.stringify(movements), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching movements:', error);
    return new Response(
      JSON.stringify({ error: 'Error al obtener los movimientos' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Cuerpo de solicitud inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { productId, type, quantity, note } = body;

    if (!productId || typeof productId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'El ID del producto es obligatorio' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (type !== 'IN' && type !== 'OUT') {
      return new Response(
        JSON.stringify({ error: 'El tipo de movimiento debe ser "IN" o "OUT"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const numQty = parseInt(String(quantity), 10);
    if (isNaN(numQty) || numQty <= 0) {
      return new Response(
        JSON.stringify({ error: 'La cantidad debe ser un entero positivo mayor a 0' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Execute atomic transaction for movement creation and stock adjustment
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      if (type === 'OUT' && product.stock < numQty) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      const newStock = type === 'IN' ? product.stock + numQty : product.stock - numQty;

      const movement = await tx.stockMovement.create({
        data: {
          type,
          quantity: numQty,
          note: typeof note === 'string' && note.trim() ? note.trim() : null,
          productId,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
        },
      });

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: newStock },
        include: {
          category: true,
        },
      });

      return { movement, product: updatedProduct };
    });

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error processing stock movement:', error);

    if (error?.message === 'PRODUCT_NOT_FOUND') {
      return new Response(
        JSON.stringify({ error: 'El producto seleccionado no existe' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (error?.message === 'INSUFFICIENT_STOCK') {
      return new Response(
        JSON.stringify({
          error: 'Stock insuficiente para realizar la venta (no puede ser negativo)',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Error al registrar el movimiento de stock' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
