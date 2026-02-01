import { z } from 'zod';

// Line item validation schema
export const lineItemSchema = z.object({
  id: z.string(),
  sku: z.string().max(50, 'SKU must be 50 characters or less').optional().nullable(),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be 500 characters or less'),
  leadTime: z.string().max(100, 'Lead time must be 100 characters or less').optional().default(''),
  moq: z.number().positive('MOQ must be positive').int('MOQ must be a whole number').max(999999, 'MOQ too large'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative').max(999999999, 'Unit price too large'),
  discountPercent: z.number().min(0, 'Discount cannot be negative').max(100, 'Discount cannot exceed 100%').optional().default(0),
  notes: z.string().max(500, 'Item notes must be 500 characters or less').optional(),
});

// Quotation form validation schema
export const quotationSchema = z.object({
  clientName: z.string().trim().min(1, 'Client name is required').max(200, 'Client name must be 200 characters or less'),
  clientEmail: z.string().trim().email('Invalid email address').max(255, 'Email must be 255 characters or less'),
  clientAddress: z.string().max(500, 'Address must be 500 characters or less').optional().or(z.literal('')),
  items: z.array(lineItemSchema).min(1, 'At least one line item is required').max(100, 'Too many line items'),
  taxRate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().nonnegative('Discount cannot be negative'),
  notes: z.string().max(2000, 'Notes must be 2000 characters or less').optional().or(z.literal('')),
  currency: z.string(),
  validUntil: z.date(),
});

// Customer validation schema
export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  email: z.string().trim().email('Invalid email address').max(255, 'Email must be 255 characters or less'),
  address: z.string().max(500, 'Address must be 500 characters or less').optional().or(z.literal('')).nullable(),
});

// Email request validation schema (for edge function)
export const emailRequestSchema = z.object({
  to: z.string().email('Invalid email address'),
  clientName: z.string().max(200),
  quoteNumber: z.string().max(50),
  total: z.string().max(100),
  validUntil: z.string(),
  pdfBase64: z.string().max(10485760, 'PDF too large (max 10MB)'),
});

export type QuotationFormValidation = z.infer<typeof quotationSchema>;
export type LineItemValidation = z.infer<typeof lineItemSchema>;
export type CustomerValidation = z.infer<typeof customerSchema>;
