import type { APIRoute } from 'astro';
import prisma from '../../../lib/prisma';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
  const { id } = params;

  if (!id || typeof id !== 'string') {
    return new Response(
      JSON.stringify({ error: 'ID de producto no proporcionado o inválido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Cuerpo de solicitud inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { name, price, categoryId } = body;
    const updateData: {
      name?: string;
      price?: number;
      categoryId?: string;
    } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return new Response(
          JSON.stringify({ error: 'El nombre no puede estar vacío' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      updateData.name = name.trim();
    }

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return new Response(
          JSON.stringify({ error: 'El precio debe ser un número mayor o igual a 0' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      updateData.price = numPrice;
    }

    if (categoryId !== undefined) {
      if (typeof categoryId !== 'string' || !categoryId.trim()) {
        return new Response(
          JSON.stringify({ error: 'El ID de categoría es inválido' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        return new Response(
          JSON.stringify({ error: 'La categoría especificada no existe' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      updateData.categoryId = categoryId;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No se enviaron campos válidos para actualizar' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error updating product:', error);
    if (error?.code === 'P2025') {
      return new Response(
        JSON.stringify({ error: 'Producto no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: 'Error al actualizar el producto' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;

  if (!id || typeof id !== 'string') {
    return new Response(
      JSON.stringify({ error: 'ID de producto no proporcionado o inválido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Delete product (StockMovement deletes on cascade as defined in schema)
    await prisma.product.delete({
      where: { id },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Producto eliminado correctamente' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error deleting product:', error);
    if (error?.code === 'P2025') {
      return new Response(
        JSON.stringify({ error: 'Producto no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: 'Error al eliminar el producto' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
