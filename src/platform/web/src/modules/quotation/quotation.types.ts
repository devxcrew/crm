export type QuotationItem = {
  amount: number;
  itemCode: string;
  itemName: string;
  name: string;
  quantity: number;
  rate: number;
  unit: string;
};

export type Quotation = {
  company: string;
  createdAt: string;
  currency: string;
  customer: string;
  customerName: string;
  enquiry: string;
  grandTotal: number;
  items: QuotationItem[];
  modifiedAt: string;
  name: string;
  owner: string;
  remarks: string;
  status: string;
  transactionDate: string;
  validTill: string;
};

export type QuotationSavePayload = {
  company: string;
  itemCode: string;
  quantity: string;
  rate: string;
  remarks: string;
  transactionDate: string;
  validTill: string;
};

export type QuotationReference = {
  id: string;
  label: string;
};

export type QuotationReferences = {
  companies: QuotationReference[];
  items: QuotationReference[];
};
