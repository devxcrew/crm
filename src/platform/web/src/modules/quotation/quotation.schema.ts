import { z } from "zod";

const positiveAmount = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/u, `${label} must be a positive number with up to 2 decimals.`)
    .refine((value) => Number(value) > 0, `${label} must be greater than zero.`);

export const quotationSchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(255),
  itemCode: z.string().trim().min(1, "Item is required.").max(255),
  quantity: positiveAmount("Quantity"),
  rate: positiveAmount("Rate"),
  remarks: z.string().trim().max(1000, "Remarks must be 1000 characters or fewer."),
  transactionDate: z.iso.date("Choose a valid quotation date."),
  validTill: z.union([z.iso.date("Choose a valid expiry date."), z.literal("")])
});
