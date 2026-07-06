export interface ShowcaseItemData {
  id: string;
  deviceType: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  workingHours: number | null;
  condition: string | null;
  price: number | null;
  currency: string;
  images: string[];
  videos: string[];
  specs: string | null;
  description: string | null;
  status: string;
  sortIndex: number;
  viewCount: number;
  inquiryCount: number;
}

export interface BoothData {
  id: string;
  name: string;
  hall: string;
  template: string;
  status: string;
  merchantId: string | null;
  coverImage: string | null;
  logoUrl: string | null;
  intro: string | null;
  sortIndex: number;
  merchant: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    location: string | null;
  } | null;
  showcaseItems: ShowcaseItemData[];
}
