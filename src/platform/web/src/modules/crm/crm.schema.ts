import { z } from "zod";

export const crmEnquirySchema = z.object({
  assignedToUserId: z.string().trim().min(1).nullable(),
  customer: z.string().trim().max(140),
  enquiryDate: z.iso.date().nullable(),
  enquiryGroup: z.string().trim().max(80),
  messages: z
    .array(
      z.object({
        comment: z.string().trim().min(1, "Message cannot be empty.").max(10_000),
        mode: z.enum(["comment", "reply"]).optional()
      })
    )
    .max(100),
  mobile: z.string().regex(/^\d{10}$/u, "Enter exactly 10 numeric digits."),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  schedules: z
    .array(z.object({ scheduledOn: z.iso.date("Choose a valid schedule date.") }))
    .max(20, "An enquiry can contain up to 20 schedule dates."),
  status: z.string().trim().min(1, "Choose a status.").max(140),
  title: z.string().trim().max(220),
  workspace: z.string().trim().max(100_000)
});

const jobTime = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/u, "Choose a valid time.");

export const crmJobSchema = z
  .object({
    employee: z.string().trim().min(1, "Choose an employee."),
    employeeCostPerHour: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,2})?$/u, "Enter a valid non-negative hourly rate.")
      .transform(Number),
    startTime: jobTime,
    status: z.enum(["Running", "Completed", "Cancelled"]),
    stopTime: z.union([jobTime, z.literal("")]).transform((value) => value || null)
  })
  .superRefine((value, context) => {
    if (value.status !== "Running" && !value.stopTime) {
      context.addIssue({
        code: "custom",
        message: "Stop time is required for a completed or cancelled job.",
        path: ["stopTime"]
      });
    }
  });
