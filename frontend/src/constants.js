import { Smartphone, BookOpen, IdCard, KeyRound, Wallet, Shirt, Dumbbell, Package } from 'lucide-react';

// Keep in sync with backend/constants/categories.js
export const CATEGORIES = ['Electronics', 'Books', 'ID Card', 'Keys', 'Wallet', 'Clothing', 'Sports', 'Other'];

export const CATEGORY_ICONS = {
  Electronics: Smartphone,
  Books: BookOpen,
  'ID Card': IdCard,
  Keys: KeyRound,
  Wallet,
  Clothing: Shirt,
  Sports: Dumbbell,
  Other: Package,
};

export const SITE_NAME = 'Campus Lost & Found';
export const PAGE_SIZE = 12;
