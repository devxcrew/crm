import { z } from "zod";

export const estimateSchema = z.object({
  date: z.iso.date("Choose a valid date."),
  enquiry: z.string().trim().min(1, "Enquiry is required.").max(255),
  itemName: z.string().trim().min(1, "Item name is required.").max(255),
  price: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/u, "Enter a positive price with up to 2 decimals.")
    .refine((value) => Number(value) > 0, "Price must be greater than zero."),
  supplier: z.string().trim().min(1, "Vendor is required.").max(255)
});
