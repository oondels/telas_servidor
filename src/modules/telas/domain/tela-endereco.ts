export interface TelaEndereco {
  id: number;
  address: string;
  vagas: number;
  barcode: string;
  usercreate: string;
  user_edit: string | null;
  created_ad: Date;
  edited_at: Date | null;
  ocupadas?: number; // Optional statistics field populated by repository
}
