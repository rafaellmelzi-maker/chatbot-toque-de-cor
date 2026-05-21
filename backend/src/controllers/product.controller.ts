import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ProductService } from '../services/product.service';

const productService = new ProductService();

const createSchema = z.object({
  categoryId: z.string().uuid(),
  brandId: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  technicalData: z.string().optional(),
  application: z.string().optional(),
  surfaces: z.array(z.string()).default([]),
  environments: z.array(z.string()).default([]),
  finishes: z.array(z.string()).default([]),
  coverage: z.number().positive().optional(),
  dryTime: z.string().optional(),
  coats: z.number().int().positive().optional(),
  dilution: z.string().optional(),
  price: z.number().positive(),
  priceUnit: z.string().default('L'),
  availableSizes: z.any().optional(),
  stock: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
  isFeatured: z.boolean().default(false),
});

export class ProductController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '20', categoryId, brandId, search } = req.query as Record<string, string>;
      const result = await productService.list(req.user!.tenantId, {
        page: parseInt(page),
        limit: parseInt(limit),
        categoryId,
        brandId,
        search,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q } = req.query as { q: string };
      const results = await productService.semanticSearch(req.user!.tenantId, q);
      res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.parse(req.body);
      const product = await productService.create(req.user!.tenantId, data);
      res.status(201).json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.partial().parse(req.body);
      const product = await productService.update(req.params.id, req.user!.tenantId, data);
      res.json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await productService.remove(req.params.id, req.user!.tenantId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  };

  generateEmbedding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await productService.generateEmbedding(req.params.id, req.user!.tenantId);
      res.json({ success: true, message: 'Embedding gerado com sucesso' });
    } catch (err) {
      next(err);
    }
  };
}
